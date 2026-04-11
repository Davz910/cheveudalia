import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/admin";

const SYSTEM_PROMPT =
  "Tu es l assistant RH et business de Cheveudalia. Génère un rapport email professionnel en français, structuré avec emojis, ton direct et actionnable. Commence par les alertes critiques. Termine par les actions prioritaires du jour.";

async function sendBrevo(params: {
  to: string[];
  subject: string;
  html: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY manquant");
  const senderEmail = process.env.BREVO_SENDER_EMAIL ?? "noreply@cheveudalia.fr";
  const senderName = process.env.BREVO_SENDER_NAME ?? "Cheveudalia";

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: params.to.map((email) => ({ email })),
      subject: params.subject,
      htmlContent: params.html,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Brevo ${res.status}: ${t}`);
  }
}

async function sendAlertEmail(subject: string, body: string) {
  const to = [process.env.REPORT_EMAIL_1, process.env.REPORT_EMAIL_2].filter(Boolean) as string[];
  if (!to.length) return;
  await sendBrevo({ to, subject, html: `<pre style="font-family:system-ui">${body}</pre>` });
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    await sendAlertEmail("Cheveudalia — échec cron rapport", "ANTHROPIC_API_KEY manquant").catch(() => "");
    return NextResponse.json({ error: "ANTHROPIC_API_KEY manquant" }, { status: 500 });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateLabel = yesterday.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

  try {
    const admin = createServiceClient();
    const tables = [
      "membres",
      "tickets_sav",
      "commandes",
      "produits",
      "clients",
      "finances_mois",
      "projets",
      "influenceurs",
      "posts_cm",
      "medias",
      "agenda",
      "messages",
      "notifications",
    ] as const;

    const snapshot: Record<string, unknown> = {};
    for (const t of tables) {
      const { data, error } = await admin.from(t).select("*").limit(500);
      if (error) snapshot[t] = { error: error.message };
      else snapshot[t] = data;
    }

    const client = new Anthropic({ apiKey: key });
    const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-20241022";

    const report = await client.messages.create({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Date du rapport (veille, Paris) : ${dateLabel}.\nDonnées agrégées (JSON) :\n${JSON.stringify(snapshot).slice(0, 120000)}`,
        },
      ],
    });

    const block = report.content[0];
    const html =
      block && block.type === "text"
        ? block.text.replace(/\n/g, "<br/>")
        : "<p>Rapport vide</p>";

    const to = [process.env.REPORT_EMAIL_1, process.env.REPORT_EMAIL_2].filter(Boolean) as string[];
    if (!to.length) {
      return NextResponse.json({ ok: true, warning: "No REPORT_EMAIL_* configured" });
    }

    await sendBrevo({
      to,
      subject: `📊 Rapport Cheveudalia — ${dateLabel}`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">${html}</div>`,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await sendAlertEmail("Cheveudalia — échec cron rapport", msg).catch(() => "");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
