import { redirect } from "next/navigation";
import { ProjetsWorkspace } from "@/components/projets/projets-workspace";
import { getSessionMembre } from "@/lib/auth/membre";

export default async function ProjetsPage() {
  const membre = await getSessionMembre();
  if (!membre) {
    redirect("/login");
  }

  const currentMembreName = [membre.prenom, membre.nom].filter(Boolean).join(" ").trim() || membre.email;

  return (
    <div className="h-full min-h-0">
      <ProjetsWorkspace currentMembreId={membre.id} currentMembreName={currentMembreName} />
    </div>
  );
}
