import { NextResponse } from "next/server";
import { getSessionMembre } from "@/lib/auth/membre";
import { createServiceClient } from "@/lib/supabase/admin";
import { sendSavReplySmtp } from "@/lib/sav/smtp-send-reply";
import { parseMsgs, type SavMsg } from "@/types/sav";

export const maxDuration = 60;

function replySubject(original: string): string {
  const t = original.trim() || "Sans objet";
  if (/^re:\s*/i.test(t)) return t;
  return `Re: ${t}`;
}

export async function POST(req: Request) {
  const membre = await getSessionMembre();
  if (!membre || (membre.role !== "sav" && membre.role !== "gerant")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { ticketId?: string; html?: string; text?: string; agentName?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const ticketId = body.ticketId?.trim();
  const html = body.html?.trim() ?? "";
  const text = body.text?.trim() ?? "";
  const agentName = body.agentName?.trim() ?? `${membre.prenom} ${membre.nom}`;

  if (!ticketId || (!html && !text)) {
    return NextResponse.json({ error: "ticketId et message requis" }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data: ticket, error: fetchErr } = await admin.from("tickets_sav").select("*").eq("id", ticketId).maybeSingle();

  if (fetchErr || !ticket) {
    return NextResponse.json({ error: fetchErr?.message ?? "Ticket introuvable" }, { status: 404 });
  }

  const to = (ticket.client_email as string | null)?.trim();
  if (!to) {
    return NextResponse.json({ error: "Aucun email client sur ce ticket" }, { status: 400 });
  }

  const subject = replySubject((ticket.sujet as string | null) ?? "");
  const htmlBody = html || `<p>${text.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</p>`;
  const textBody = text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  try {
    await sendSavReplySmtp({
      to,
      subject,
      html: htmlBody,
      text: textBody,
      inReplyTo: (ticket.imap_last_message_id as string | null) ?? undefined,
      references: (ticket.imap_references as string | null) ?? undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const h = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const msg: SavMsg = { d: "out", t: html || text, h, agent: agentName };
  const prev = parseMsgs(ticket.msgs);
  const next = [...prev, msg];

  const { error: upErr } = await admin.from("tickets_sav").update({ msgs: next }).eq("id", ticketId);
  if (upErr) {
    return NextResponse.json({ error: `Email envoyé mais enregistrement échoué : ${upErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
