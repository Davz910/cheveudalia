import { Card } from "@/components/ui/card";

export default function FinancesPage() {
  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <Card className="border-border/80 p-4 text-sm text-muted-foreground">
        Pockets (27.5% / 15% / 10% / 1.5% / 2% / 5%) — table <code className="text-foreground">finances_mois</code>.
        Clôture mensuelle + dépenses.
      </Card>
    </div>
  );
}
