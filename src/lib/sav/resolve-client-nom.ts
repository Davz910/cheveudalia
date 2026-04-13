import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExtractedContact } from "@/lib/sav/claude-extract-contact";

type ClientRow = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  tel: string | null;
};

/** Recherche un client par email puis par prénom+nom (correspondance IA). */
export async function findMatchingClient(
  admin: SupabaseClient,
  extracted: ExtractedContact,
  fallbackEmail: string
): Promise<ClientRow | null> {
  const emailCandidate = (extracted.email?.trim().toLowerCase() || fallbackEmail.trim().toLowerCase()).trim();
  if (emailCandidate && emailCandidate.includes("@")) {
    const { data } = await admin.from("clients").select("id,prenom,nom,email,tel").ilike("email", emailCandidate).maybeSingle();
    if (data) return data as ClientRow;
    const { data: exact } = await admin.from("clients").select("id,prenom,nom,email,tel").eq("email", emailCandidate).maybeSingle();
    if (exact) return exact as ClientRow;
  }

  const prenom = extracted.prenom?.trim();
  const nom = extracted.nom?.trim();
  if (prenom && nom) {
    const { data } = await admin
      .from("clients")
      .select("id,prenom,nom,email,tel")
      .ilike("prenom", prenom)
      .ilike("nom", nom)
      .maybeSingle();
    if (data) return data as ClientRow;
  }

  return null;
}

export function ticketClientNom(
  client: ClientRow | null,
  extracted: ExtractedContact,
  fromName: string | null
): string {
  if (client) {
    return `${client.prenom ?? ""} ${client.nom ?? ""}`.trim() || "Client";
  }
  const fromExtracted = [extracted.prenom, extracted.nom].filter(Boolean).join(" ").trim();
  if (fromExtracted) return fromExtracted;
  if (fromName?.trim()) return fromName.trim();
  return "Client non identifié";
}
