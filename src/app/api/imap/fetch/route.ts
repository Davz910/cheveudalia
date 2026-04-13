import { NextResponse } from "next/server";
import { getSessionMembre } from "@/lib/auth/membre";
import { runImapFetch } from "@/lib/sav/run-imap-fetch";

export const maxDuration = 120;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const bearerOk = Boolean(secret && auth === `Bearer ${secret}`);
  /** Vercel Cron envoie ce header ; pas de Bearer configurable dans vercel.json */
  const vercelCron = req.headers.get("x-vercel-cron") === "1" && process.env.VERCEL === "1";
  const fromCron = bearerOk || vercelCron;

  if (!fromCron) {
    const membre = await getSessionMembre();
    if (!membre || (membre.role !== "sav" && membre.role !== "gerant")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runImapFetch();
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
