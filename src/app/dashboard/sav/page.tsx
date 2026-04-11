import { redirect } from "next/navigation";
import { SavWorkspace } from "@/components/sav/sav-workspace";
import { getSessionMembre } from "@/lib/auth/membre";

export default async function SavPage() {
  const membre = await getSessionMembre();
  if (!membre) {
    redirect("/login");
  }

  const name = `${membre.prenom} ${membre.nom}`.trim();
  const canMutate = membre.role === "sav" || membre.role === "gerant";

  return (
    <div className="h-full min-h-0">
      <SavWorkspace currentMembreName={name || "Agent"} canMutate={canMutate} />
    </div>
  );
}
