import { NextResponse } from "next/server";
import { getSessionMembre } from "@/lib/auth/membre";
import { maskImapPassword, runImapFetch } from "@/lib/sav/run-imap-fetch";

export const maxDuration = 120;

function errFull(e: unknown): string {
  if (e instanceof Error) {
    return e.stack ?? e.message;
  }
  return String(e);
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const bearerOk = Boolean(secret && auth === `Bearer ${secret}`);
  /** Vercel Cron envoie ce header ; pas de Bearer configurable dans vercel.json */
  const vercelCron = req.headers.get("x-vercel-cron") === "1" && process.env.VERCEL === "1";
  const fromCron = bearerOk || vercelCron;

  if (!fromCron) {
    const membre = await getSessionMembre();
    const sessionOk = Boolean(membre && (membre.role === "sav" || membre.role === "gerant"));
    console.log("[api/imap/fetch] authentification dashboard (session cookie)", {
      sessionValide: Boolean(membre),
      role: membre?.role ?? null,
      email: membre?.email ?? null,
      accèsImap: sessionOk,
    });
    if (!sessionOk) {
      console.warn("[api/imap/fetch] refus — pas de session SAV/gérant valide");
      return NextResponse.json(
        { error: "Unauthorized", connected: false, emailsFound: 0, processed: 0, errors: ["Non autorisé"] },
        { status: 401 }
      );
    }
  } else {
    console.log("[api/imap/fetch] authentification cron / tâche planifiée", {
      bearerOk,
      vercelCron,
    });
  }

  console.log("[api/imap/fetch] variables IMAP (mot de passe masqué)", {
    IMAP_HOST: process.env.IMAP_HOST ?? "(non défini)",
    IMAP_PORT: process.env.IMAP_PORT ?? "(non défini)",
    IMAP_USER: process.env.IMAP_USER ?? "(non défini)",
    IMAP_PASSWORD: maskImapPassword(process.env.IMAP_PASSWORD),
    IMAP_TLS: process.env.IMAP_TLS ?? "(non défini — défaut: true)",
  });

  try {
    const result = await runImapFetch();
    console.log("[api/imap/fetch] résultat", result);
    return NextResponse.json(result);
  } catch (e) {
    const full = errFull(e);
    console.error("[api/imap/fetch] exception non gérée", full);
    return NextResponse.json(
      {
        connected: false,
        emailsFound: 0,
        processed: 0,
        skipped: 0,
        errors: [full],
      },
      { status: 500 }
    );
  }
}
