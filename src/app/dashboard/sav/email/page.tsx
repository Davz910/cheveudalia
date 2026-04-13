import { redirect } from "next/navigation";

/** Ancienne URL : même écran que /dashboard/sav */
export default function SavEmailLegacyPage() {
  redirect("/dashboard/sav");
}
