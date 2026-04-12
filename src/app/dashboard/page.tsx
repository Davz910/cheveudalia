import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardAgenda } from "@/components/dashboard/dashboard-agenda";

export default function DashboardPage() {
  return (
    <div className="h-full overflow-y-auto px-4 py-4 md:px-5 md:py-[18px]">
      <div className="mb-[18px] grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Card className="border-border/80 py-3.5">
          <div className="px-4">
            <div className="mb-1.5 text-[11px] text-muted-foreground">CA du mois</div>
            <div className="text-[22px] font-medium">14 280 €</div>
            <div className="mt-1 text-[11px] text-[#3B6D11]">+18% vs mois dernier</div>
          </div>
        </Card>
        <Card className="border-border/80 py-3.5">
          <div className="px-4">
            <div className="mb-1.5 text-[11px] text-muted-foreground">Commandes</div>
            <div className="text-[22px] font-medium">312</div>
            <div className="mt-1 text-[11px] text-[#3B6D11]">+9%</div>
          </div>
        </Card>
        <Card className="border-border/80 py-3.5">
          <div className="px-4">
            <div className="mb-1.5 text-[11px] text-muted-foreground">Panier moyen</div>
            <div className="text-[22px] font-medium">45,80 €</div>
            <div className="mt-1 text-[11px] text-[#3B6D11]">+3%</div>
          </div>
        </Card>
        <Card className="border-border/80 py-3.5">
          <div className="px-4">
            <div className="mb-1.5 text-[11px] text-muted-foreground">Taux retour</div>
            <div className="text-[22px] font-medium">3,2%</div>
            <div className="mt-1 text-[11px] text-[#3B6D11]">-0.4pt</div>
          </div>
        </Card>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-[340px_1fr]">
        <DashboardAgenda />

        <div className="flex min-w-0 flex-col gap-3">
          <Card className="min-w-0 border-border/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-4">
              <CardTitle className="truncate text-[13px] font-medium">Dernières commandes</CardTitle>
              <span className="shrink-0 cursor-pointer text-[11px] text-primary">Voir tout →</span>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-8 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Client
                    </TableHead>
                    <TableHead className="h-8 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Marché
                    </TableHead>
                    <TableHead className="h-8 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Montant
                    </TableHead>
                    <TableHead className="h-8 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Statut
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["Amara K.", "🇫🇷", "52 €", "Livré", "green"],
                    ["Priya M.", "🇫🇷", "52 €", "En transit", "amber"],
                    ["Lena M.", "🇳🇱", "52 €", "En transit", "amber"],
                    ["Fatou N.", "🇧🇪", "29 €", "Problème", "red"],
                  ].map(([c, m, price, st, variant]) => (
                    <TableRow key={String(c)} className="text-xs">
                      <TableCell className="py-2">{c}</TableCell>
                      <TableCell className="py-2">{m}</TableCell>
                      <TableCell className="py-2">{price}</TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant={
                            variant === "green"
                              ? "green"
                              : variant === "amber"
                                ? "amber"
                                : "red"
                          }
                        >
                          {st}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-[13px] font-medium">SAV du jour</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ouverts</span>
                <span className="font-medium text-[#A32D2D]">4</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Résolus</span>
                <span className="font-medium text-[#3B6D11]">7</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tps moyen rép.</span>
                <span className="font-medium">3h20</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="border-border/80">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-[13px] font-medium">Répartition marchés</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pb-4 text-xs">
            <div className="flex justify-between">
              <span>🇫🇷 France</span>
              <span className="font-medium">10 280 € · 72%</span>
            </div>
            <div className="flex justify-between">
              <span>🇩🇪 Allemagne</span>
              <span className="font-medium">2 570 € · 18%</span>
            </div>
            <div className="flex justify-between">
              <span>🇧🇪 Belgique</span>
              <span className="font-medium">980 € · 7%</span>
            </div>
            <div className="flex justify-between">
              <span>🇳🇱/🇱🇺 Autres</span>
              <span className="font-medium">450 € · 3%</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-[13px] font-medium">Marketing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pb-4 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">ROAS campagne FR</span>
              <span className="font-medium text-[#3B6D11]">4.2x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CAC</span>
              <span className="font-medium">8,20 €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TikTok abonnés</span>
              <span className="font-medium">12,4k</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-[13px] font-medium">SAV du jour</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pb-4 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ouverts</span>
              <span className="font-medium text-[#A32D2D]">4</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Résolus</span>
              <span className="font-medium text-[#3B6D11]">7</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tps moyen rép.</span>
              <span className="font-medium">3h20</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
