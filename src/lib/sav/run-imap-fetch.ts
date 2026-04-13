import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { createServiceClient } from "@/lib/supabase/admin";
import { extractContactWithClaude, type ExtractedContact } from "@/lib/sav/claude-extract-contact";
import { findMatchingClient, ticketClientNom } from "@/lib/sav/resolve-client-nom";

const EMPTY_EXTRACTED: ExtractedContact = {
  prenom: null,
  nom: null,
  email: null,
  telephone: null,
  numero_commande: null,
};
import { parseMsgs, type SavMsg } from "@/types/sav";

function formatMsgTime() {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function normalizeMessageId(id: string | undefined | null): string | null {
  if (!id?.trim()) return null;
  return id.trim().replace(/^<|>$/g, "");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export type ImapFetchResult = {
  processed: number;
  skipped: number;
  errors: string[];
};

export async function runImapFetch(): Promise<ImapFetchResult> {
  const host = process.env.IMAP_HOST;
  const port = Number(process.env.IMAP_PORT ?? "993");
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASSWORD;
  const secure = process.env.IMAP_TLS !== "false" && process.env.IMAP_TLS !== "0";

  if (!host || !user || !pass) {
    throw new Error("IMAP_HOST, IMAP_USER ou IMAP_PASSWORD manquant");
  }

  const admin = createServiceClient();
  const errors: string[] = [];
  let processed = 0;
  let skipped = 0;

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: false,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const searchResult = await client.search({ seen: false }, { uid: true });
      const uids = searchResult === false ? [] : searchResult;
      if (uids.length === 0) {
        return { processed: 0, skipped: 0, errors: [] };
      }

      for (const uid of uids) {
        try {
          const fetched = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!fetched || !("source" in fetched) || !fetched.source) {
            skipped += 1;
            continue;
          }
          const parsed = await simpleParser(fetched.source);

          const messageIdRaw = parsed.messageId ?? undefined;
          const mid = normalizeMessageId(messageIdRaw);
          if (mid) {
            const { data: seen } = await admin.from("sav_imap_processed").select("message_id").eq("message_id", mid).maybeSingle();
            if (seen) {
              await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
              skipped += 1;
              continue;
            }
          }

          const fromAddr = parsed.from?.value?.[0];
          const fromEmail = (fromAddr?.address ?? "").trim().toLowerCase();
          const fromName = fromAddr?.name?.trim() ?? null;
          if (!fromEmail) {
            await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
            skipped += 1;
            continue;
          }

          const subjectRaw = typeof parsed.subject === "string" ? parsed.subject : "";
          const subject = subjectRaw.trim() || "Sans objet";
          const htmlStr = typeof parsed.html === "string" ? parsed.html : null;
          const bodyHtml = htmlStr?.trim() || null;
          const textStr = typeof parsed.text === "string" ? parsed.text : "";
          const bodyText = textStr.trim() || stripHtml(bodyHtml ?? "") || "(message vide)";
          const bodyForTicket = bodyHtml || `<pre>${bodyText.replace(/</g, "&lt;")}</pre>`;

          const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

          let clientNom: string;
          let clientTel: string | null;

          if (hasAnthropicKey) {
            const rawForAi = `Sujet: ${subject}\nDe: ${fromName ?? ""} <${fromEmail}>\n\n${bodyText}`.slice(0, 100_000);
            const extracted = await extractContactWithClaude(rawForAi);
            const matched = await findMatchingClient(admin, extracted, fromEmail);
            clientNom = ticketClientNom(matched, extracted, fromName);
            clientTel = matched?.tel?.trim() || extracted.telephone?.trim() || null;
          } else {
            const matched = await findMatchingClient(admin, EMPTY_EXTRACTED, fromEmail);
            clientNom = ticketClientNom(matched, EMPTY_EXTRACTED, fromName);
            clientTel = matched?.tel?.trim() || null;
          }

          const h = formatMsgTime();
          const incomingMsg: SavMsg = { d: "in", t: bodyForTicket, h };

          const refJoined = Array.isArray(parsed.references)
            ? parsed.references.join(" ")
            : (parsed.references?.toString().trim() ?? "");
          const refsChain = [refJoined, messageIdRaw].filter(Boolean).join(" ").trim() || null;
          const newRefs = refsChain || messageIdRaw || null;

          const { data: existingList } = await admin
            .from("tickets_sav")
            .select("id,msgs,etat,client_email,sujet,imap_last_message_id,imap_references")
            .eq("canal", "email")
            .ilike("client_email", fromEmail);

          const openTicket = (existingList ?? []).find((t) => {
            const e = (t.etat ?? "").toLowerCase();
            return e !== "archive" && e !== "resolu";
          });

          if (openTicket) {
            const prev = parseMsgs(openTicket.msgs);
            const nextMsgs = [...prev, incomingMsg];
            const { error: upErr } = await admin
              .from("tickets_sav")
              .update({
                msgs: nextMsgs,
                updated_at: new Date().toISOString(),
                imap_last_message_id: mid ?? openTicket.imap_last_message_id,
                imap_references: newRefs ?? openTicket.imap_references,
              })
              .eq("id", openTicket.id);

            if (upErr) {
              errors.push(`UID ${uid}: ${upErr.message}`);
              continue;
            }

            if (mid) {
              await admin.from("sav_imap_processed").upsert(
                { message_id: mid, ticket_id: openTicket.id },
                { onConflict: "message_id" }
              );
            }
            processed += 1;
          } else {
            const { data: inserted, error: insErr } = await admin
              .from("tickets_sav")
              .insert({
                canal: "email",
                statut: "ouvert",
                etat: "actif",
                client_email: fromEmail,
                client_nom: clientNom,
                client_tel: clientTel,
                sujet: subject,
                msgs: [incomingMsg],
                imap_last_message_id: mid,
                imap_references: newRefs,
              })
              .select("id")
              .single();

            if (insErr || !inserted) {
              errors.push(`UID ${uid}: ${insErr?.message ?? "insert"}`);
              continue;
            }

            if (mid) {
              await admin.from("sav_imap_processed").upsert(
                { message_id: mid, ticket_id: inserted.id },
                { onConflict: "message_id" }
              );
            }
            processed += 1;
          }

          await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`UID ${uid}: ${msg}`);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return { processed, skipped, errors };
}
