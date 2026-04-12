import { redirect } from "next/navigation";
import { getSessionMembre } from "@/lib/auth/membre";
import { MembresWorkspace } from "@/components/membres/membres-workspace";

export default async function MembresPage() {
  const membre = await getSessionMembre();
  if (!membre || membre.role !== "gerant") {
    redirect("/dashboard");
  }

  return (
    <div className="h-full min-h-0">
      <MembresWorkspace currentGerantId={membre.id} />
    </div>
  );
}
