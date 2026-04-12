import { redirect } from "next/navigation";
import { getSessionMembre } from "@/lib/auth/membre";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ModuleAccessGuard } from "@/components/dashboard/module-access-guard";
import { EquipeOpenConvProvider } from "@/components/equipe/equipe-open-conv-context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const membre = await getSessionMembre();
  if (!membre) {
    redirect("/login");
  }

  return (
    <ModuleAccessGuard role={membre.role} permissions={membre.permissions}>
      <EquipeOpenConvProvider>
        <DashboardShell
          membre={{
            id: membre.id,
            prenom: membre.prenom,
            nom: membre.nom,
            role: membre.role,
            avatar_url: membre.avatar_url,
          }}
        >
          {children}
        </DashboardShell>
      </EquipeOpenConvProvider>
    </ModuleAccessGuard>
  );
}
