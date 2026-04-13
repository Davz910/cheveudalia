import nodemailer from "nodemailer";

export type SendSavReplyParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
  inReplyTo?: string | null;
  references?: string | null;
};

export async function sendSavReplySmtp(params: SendSavReplyParams): Promise<void> {
  const host = process.env.SMTP_HOST ?? "smtp.ionos.fr";
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER ?? process.env.IMAP_USER;
  const pass = process.env.SMTP_PASSWORD ?? process.env.IMAP_PASSWORD;
  const from = process.env.SMTP_FROM ?? "hello@cabinet-sng.fr";

  if (!user || !pass) {
    throw new Error("SMTP_USER / SMTP_PASSWORD (ou IMAP_*) manquants pour l’envoi email");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
  });

  const headers: Record<string, string> = {};
  if (params.inReplyTo) {
    const mid = params.inReplyTo.startsWith("<") ? params.inReplyTo : `<${params.inReplyTo}>`;
    headers["In-Reply-To"] = mid;
  }
  if (params.references) {
    headers.References = params.references;
  }

  await transporter.sendMail({
    from: `Cabinet SNG <${from}>`,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    headers: Object.keys(headers).length ? headers : undefined,
  });
}
