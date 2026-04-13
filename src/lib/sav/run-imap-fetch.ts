import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { createServiceClient } from "@/lib/supabase/admin";
import { extractContactWithClaude, type ExtractedContact } from "@/lib/sav/claude-extract-contact";
import { findMatchingClient, ticketClientNom } from "@/lib/sav/resolve-client-nom";
import { parseMsgs, type SavMsg } from "@/types/sav";

const LOG = "[imap-fetch]";

const EMPTY_EXTRACTED: ExtractedContact = {
  prenom: null,
  nom: null,
  email: null,
  telephone: null,
  numero_commande: null,
};

/** Mot de passe masqué pour les logs (ne jamais logger en clair). */
export function maskImapPassword(value: string | undefined): string {
  if (!value) return "(non défini)";
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}…${value.slice(-2)} (${value.length} car.)`;
}

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

function errFull(e: unknown): string {
  if (e instanceof Error) {
    return e.stack ?? e.message;
  }
  return String(e);
}

export type ImapFetchResult = {
  connected: boolean;
  emailsFound: number;
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

  console.log(`${LOG} variables IMAP lues`, {
    IMAP_HOST: host ?? "(non défini)",
    IMAP_PORT: port,
    IMAP_USER: user ?? "(non défini)",
    IMAP_PASSWORD: maskImapPassword(pass),
    IMAP_TLS: secure,
  });

  if (!host || !user || !pass) {
    const msg = "IMAP_HOST, IMAP_USER ou IMAP_PASSWORD manquant";
    console.error(`${LOG} ${msg}`);
    return { connected: false, emailsFound: 0, processed: 0, skipped: 0, errors: [msg] };
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

  try {
    console.log(`${LOG} connexion IMAP vers ${host}:${port} (TLS=${secure})…`);
    await client.connect();
    console.log(`${LOG} connexion IMAP réussie`);
  } catch (e) {
    const full = errFull(e);
    console.error(`${LOG} échec connexion IMAP`, full);
    errors.push(`Connexion IMAP: ${full}`);
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
    return { connected: false, emailsFound: 0, processed: 0, skipped: 0, errors };
  }

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const searchResult = await client.search({ seen: false }, { uid: true });
      const uids = searchResult === false ? [] : searchResult;
      const emailsFound = uids.length;
      console.log(`${LOG} emails non lus (UIDs): ${emailsFound}`, uids);

      if (uids.length === 0) {
        return { connected: true, emailsFound, processed: 0, skipped: 0, errors: [] };
      }

      for (const uid of uids) {
        try {
          const fetched = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!fetched || !("source" in fetched) || !fetched.source) {
            const msg = `UID ${uid}: pas de contenu source`;
            console.warn(`${LOG} ${msg}`);
            errors.push(msg);
            skipped += 1;
            continue;
          }
          const parsed = await simpleParser(fetched.source);

          const messageIdRaw = parsed.messageId ?? undefined;
          const mid = normalizeMessageId(messageIdRaw);
          if (mid) {
            const { data: seen } = await admin.from("sav_imap_processed").select("message_id").eq("message_id", mid).maybeSingle();
            if (seen) {
              console.log(`${LOG} UID ${uid} déjà traité (Message-ID), ignoré`);
              await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
              skipped += 1;
              continue;
            }
          }

          const fromAddr = parsed.from?.value?.[0];
          const fromEmail = (fromAddr?.address ?? "").trim().toLowerCase();
          const fromName = fromAddr?.name?.trim() ?? null;
          const subjectRaw = typeof parsed.subject === "string" ? parsed.subject : "";
          const subject = subjectRaw.trim() || "Sans objet";

          console.log(`${LOG} email UID ${uid}`, {
            sujet: subject,
            expediteur: fromName ? `${fromName} <${fromEmail}>` : fromEmail || "(sans adresse)",
          });

          if (!fromEmail) {
            console.warn(`${LOG} UID ${uid}: pas d’adresse expéditeur, ignoré`);
            await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
            skipped += 1;
            continue;
          }

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
              const full = `UID ${uid} mise à jour ticket: ${upErr.message}${upErr.details ? ` — ${upErr.details}` : ""}${upErr.hint ? ` hint:${upErr.hint}` : ""}`;
              console.error(`${LOG} ${full}`);
              errors.push(full);
              continue;
            }

            if (mid) {
              await admin.from("sav_imap_processed").upsert(
                { message_id: mid, ticket_id: openTicket.id },
                { onConflict: "message_id" }
              );
            }
            processed += 1;
            console.log(`${LOG} UID ${uid}: message ajouté au ticket ${openTicket.id}`);
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
              const full = `UID ${uid} insert ticket: ${insErr?.message ?? "insert"}${insErr?.details ? ` — ${insErr.details}` : ""}${insErr?.hint ? ` hint:${insErr.hint}` : ""}`;
              console.error(`${LOG} ${full}`);
              errors.push(full);
              continue;
            }

            if (mid) {
              await admin.from("sav_imap_processed").upsert(
                { message_id: mid, ticket_id: inserted.id },
                { onConflict: "message_id" }
              );
            }
            processed += 1;
            console.log(`${LOG} UID ${uid}: nouveau ticket créé ${inserted.id}`);
          }

          await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
        } catch (e) {
          const full = errFull(e);
          console.error(`${LOG} erreur traitement UID ${uid}`, full);
          errors.push(`UID ${uid}: ${full}`);
        }
      }

      return { connected: true, emailsFound, processed, skipped, errors };
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
      console.log(`${LOG} session IMAP fermée`);
    } catch (e) {
      console.warn(`${LOG} logout IMAP`, errFull(e));
    }
  }
}
