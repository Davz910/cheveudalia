import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function LogistiquePage() {
  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2.5">
        <span className="text-[13px] font-medium">Logistique & Suivi colis</span>
        <input
          className="max-w-[320px] flex-1 rounded-md border border-border px-2 py-1 text-xs"
          placeholder="Rechercher client, commande, tracking…"
        />
        <div className="flex gap-1 text-xs">
          {["En transit", "Problèmes", "Livrés", "Stocks"].map((t) => (
            <span key={t} className="rounded-md bg-[hsl(336_56%_95%)] px-3 py-1.5 font-medium text-primary">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-3 p-2">
        <Card className="border-border/80 p-4">
          <div className="mb-2 flex justify-between text-xs">
            <span>Colis #CHV-10431</span>
            <span className="text-muted-foreground">En transit</span>
          </div>
          <Progress value={65} />
        </Card>
      </div>
    </div>
  );
}
