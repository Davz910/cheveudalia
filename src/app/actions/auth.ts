"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { defaultDashboardPath, type Role } from "@/lib/roles";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  const next = String(formData.get("next") ?? "/dashboard").trim() || "/dashboard";

  if (!email || !code) {
    return { error: "Email et code requis." };
  }

  const admin = createServiceClient();
  const { data: membre, error: fetchErr } = await admin
    .from("membres")
    .select("id,email,role,code_acces,expiration_acces,statut,auth_user_id")
    .eq("email", email)
    .maybeSingle();

  if (fetchErr || !membre) {
    return { error: "Email ou code d’accès invalide." };
  }

  if (membre.statut && membre.statut !== "actif") {
    return { error: "Compte inactif." };
  }

  if (!membre.code_acces || membre.code_acces !== code) {
    return { error: "Email ou code d’accès invalide." };
  }

  if (membre.expiration_acces) {
    const exp = new Date(membre.expiration_acces);
    if (exp.getTime() < Date.now()) {
      return { error: "Code d’accès expiré. Contactez un administrateur." };
    }
  }

  try {
    if (membre.auth_user_id) {
      const { error: updErr } = await admin.auth.admin.updateUserById(membre.auth_user_id, {
        password: code,
      });
      if (updErr) throw updErr;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: code,
        email_confirm: true,
      });
      if (createErr || !created.user) throw createErr ?? new Error("createUser");

      const { error: linkErr } = await admin
        .from("membres")
        .update({ auth_user_id: created.user.id })
        .eq("id", membre.id);
      if (linkErr) throw linkErr;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur d’authentification.";
    return { error: msg };
  }

  const supabase = await createClient();
  const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: code });
  if (signErr) {
    return { error: signErr.message };
  }

  revalidatePath("/", "layout");

  const role = membre.role as Role;
  const dest = next.startsWith("/dashboard") ? next : defaultDashboardPath(role);
  redirect(dest);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
