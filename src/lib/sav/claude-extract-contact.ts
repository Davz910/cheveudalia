import Anthropic from "@anthropic-ai/sdk";

export type ExtractedContact = {
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  numero_commande: string | null;
};

const PROMPT_PREFIX =
  "Voici un email reçu par notre SAV. Extrait les informations suivantes en JSON : { prenom, nom, email, telephone, numero_commande }. Si une information n'est pas trouvée mets null. Réponds UNIQUEMENT avec un objet JSON valide, sans markdown. Email :\n\n";

export async function extractContactWithClaude(rawEmailContent: string): Promise<ExtractedContact> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      prenom: null,
      nom: null,
      email: null,
      telephone: null,
      numero_commande: null,
    };
  }

  const client = new Anthropic({ apiKey: key });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-20241022";
  const truncated = rawEmailContent.slice(0, 100_000);

  const res = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `${PROMPT_PREFIX}${truncated}`,
      },
    ],
  });

  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    return {
      prenom: null,
      nom: null,
      email: null,
      telephone: null,
      numero_commande: null,
    };
  }

  let text = block.text.trim();
  const jsonFence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(text);
  if (jsonFence?.[1]) text = jsonFence[1].trim();

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      prenom: typeof parsed.prenom === "string" ? parsed.prenom : null,
      nom: typeof parsed.nom === "string" ? parsed.nom : null,
      email: typeof parsed.email === "string" ? parsed.email : null,
      telephone: typeof parsed.telephone === "string" ? parsed.telephone : null,
      numero_commande: typeof parsed.numero_commande === "string" ? parsed.numero_commande : null,
    };
  } catch {
    return {
      prenom: null,
      nom: null,
      email: null,
      telephone: null,
      numero_commande: null,
    };
  }
}
