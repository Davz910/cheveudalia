import { Card } from "@/components/ui/card";

const SECTIONS = [
  "Identité marque",
  "Marchés",
  "Finances",
  "SAV",
  "Rapport quotidien",
  "Alertes & seuils",
  "Membres",
  "Influenceurs",
  "Intégrations & API",
];

export default function ConfigurationPage() {
  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="grid gap-3 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <Card key={s} className="border-border/80 p-4">
            <div className="text-[13px] font-medium">{s}</div>
            <p className="mt-2 text-xs text-muted-foreground">
              Champs éditables — stockage recommandé : table <code className="text-foreground">app_configuration</code>.
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
