import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

export type MembreRow = {
  id: string;
  auth_user_id: string | null;
  prenom: string;
  nom: string;
  email: string;
  role: Role;
  statut: string | null;
  permissions: Record<string, unknown> | null;
  avatar_url?: string | null;
};

export async function getSessionMembre(): Promise<MembreRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("membres")
    .select("id,auth_user_id,prenom,nom,email,role,statut,permissions,avatar_url")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as MembreRow & { avatar_url?: string | null };
  return { ...row, avatar_url: row.avatar_url ?? null };
}
