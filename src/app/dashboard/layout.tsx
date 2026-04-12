import { redirect } from "next/navigation";
import { getSessionMembre } from "@/lib/auth/membre";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ModuleAccessGuard } from "@/components/dashboard/module-access-guard";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const membre = await getSessionMembre();
  if (!membre) {
    redirect("/login");
  }

  return (
    <ModuleAccessGuard role={membre.role} permissions={membre.permissions}>
      <DashboardShell
        membre={{
          id: membre.id,
          prenom: membre.prenom,
          nom: membre.nom,
          role: membre.role,
        }}
      >
        {children}
      </DashboardShell>
    </ModuleAccessGuard>
  );
}
