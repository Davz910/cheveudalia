import { redirect } from "next/navigation";
import { EquipeChat } from "@/components/equipe/equipe-chat";
import { getSessionMembre } from "@/lib/auth/membre";

export default async function EquipePage() {
  const membre = await getSessionMembre();
  if (!membre) {
    redirect("/login");
  }

  return (
    <div className="h-full min-h-0">
      <EquipeChat
        currentMembre={{
          id: membre.id,
          prenom: membre.prenom,
          nom: membre.nom,
          email: membre.email,
        }}
      />
    </div>
  );
}
