import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function MarketingPage() {
  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="mb-4 grid grid-cols-4 gap-2.5">
        {[
          ["ROAS global", "3,8x", "+0.3 vs mois dernier"],
          ["Emails envoyés", "8 400", "Taux ouv. 34%"],
          ["Conversions", "4,1%", "+0.6pt"],
          ["CAC", "8,20 €", "-1.50 € vs objectif"],
        ].map(([a, b, c]) => (
          <Card key={String(a)} className="border-border/80 py-3">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-[11px] font-normal text-muted-foreground">{a}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-[22px] font-medium">{b}</div>
              <div className="mt-1 text-[11px] text-[#3B6D11]">{c}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border/80">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-[13px] font-medium">Campagnes actives</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] uppercase">Campagne</TableHead>
                <TableHead className="text-[10px] uppercase">Canal</TableHead>
                <TableHead className="text-[10px] uppercase">Marché</TableHead>
                <TableHead className="text-[10px] uppercase">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-xs">Relance panier abandonné</TableCell>
                <TableCell className="text-xs">Klaviyo</TableCell>
                <TableCell className="text-xs">🇫🇷</TableCell>
                <TableCell>
                  <Badge variant="green">Actif</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
