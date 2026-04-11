import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ClientsPage() {
  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="mb-4 flex flex-wrap gap-2">
        {["Tous", "VIP (+150€)", "Fidèles (3+ cmds)", "Nouveaux", "À risque"].map((s) => (
          <Button key={s} variant="outline" size="sm" className="h-8 text-xs">
            {s}
          </Button>
        ))}
      </div>
      <Card className="border-border/80 p-4 text-sm text-muted-foreground">
        CRM — fiche client, historique, note interne, ouverture ticket SAV. Données : table{" "}
        <code className="text-foreground">clients</code>.
      </Card>
    </div>
  );
}
