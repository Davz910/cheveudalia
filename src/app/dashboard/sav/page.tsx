import { redirect } from "next/navigation";

/** Ancienne route : redirection vers le canal email par défaut */
export default function SavIndexPage() {
  redirect("/dashboard/sav/email");
}
