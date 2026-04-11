import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY manquant" }, { status: 500 });
  }

  const body = (await req.json()) as { message?: string; role?: string };
  const message = String(body.message ?? "").trim();
  const role = String(body.role ?? "Gérant");
  if (!message) {
    return NextResponse.json({ error: "Message vide" }, { status: 400 });
  }

  const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-20241022";

  const client = new Anthropic({ apiKey: key });
  try {
    const res = await client.messages.create({
      model,
      max_tokens: 2048,
      system: `Tu es l'assistant opérationnel Cheveudalia. Contexte rôle : ${role}. Réponds en français, concis et actionnable.`,
      messages: [{ role: "user", content: message }],
    });
    const block = res.content[0];
    const text = block && block.type === "text" ? block.text : "";
    return NextResponse.json({ text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur Claude";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
