"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Cmd = {
  ref: string;
  client: string;
  marche: string;
  montant: string;
  statut: string;
};

const DATA: Cmd[] = [
  { ref: "CHV-10432", client: "Amara K.", marche: "FR", montant: "52 €", statut: "Livré" },
  { ref: "CHV-10431", client: "Priya M.", marche: "FR", montant: "52 €", statut: "En transit" },
];

export default function CommandesPage() {
  const [marche, setMarche] = useState<string>("all");
  const [statut, setStatut] = useState<string>("all");
  const [q, setQ] = useState("");

  const columns = useMemo<ColumnDef<Cmd>[]>(
    () => [
      { accessorKey: "ref", header: "Réf." },
      { accessorKey: "client", header: "Client" },
      { accessorKey: "marche", header: "Marché" },
      { accessorKey: "montant", header: "Montant" },
      {
        accessorKey: "statut",
        header: "Statut",
        cell: ({ getValue }) => {
          const v = String(getValue());
          const variant =
            v === "Livré" ? "green" : v === "En transit" ? "amber" : v === "Problème" ? "red" : "outline";
          return <Badge variant={variant as "green" | "amber" | "red" | "outline"}>{v}</Badge>;
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: DATA,
    columns,
    state: { globalFilter: q },
    onGlobalFilterChange: setQ,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _col, filter) => {
      const f = String(filter).toLowerCase();
      if (!f) return true;
      const o = row.original;
      return (
        o.ref.toLowerCase().includes(f) ||
        o.client.toLowerCase().includes(f) ||
        o.marche.toLowerCase().includes(f)
      );
    },
  });

  const filtered = table
    .getFilteredRowModel()
    .rows.filter((r) => {
      const o = r.original;
      if (marche !== "all" && o.marche !== marche) return false;
      if (statut !== "all" && o.statut !== statut) return false;
      return true;
    });

  return (
    <div className="h-full overflow-y-auto px-4 py-4 md:px-5">
      <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Card className="border-border/80 py-3">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[11px] font-normal text-muted-foreground">Commandes du jour</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[22px] font-medium">24</div>
          </CardContent>
        </Card>
        <Card className="border-border/80 py-3">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[11px] font-normal text-muted-foreground">CA du jour</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[22px] font-medium">1 180 €</div>
          </CardContent>
        </Card>
        <Card className="border-border/80 py-3">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[11px] font-normal text-muted-foreground">Panier moyen</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[22px] font-medium">49,20 €</div>
          </CardContent>
        </Card>
        <Card className="border-border/80 py-3">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[11px] font-normal text-muted-foreground">En attente</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[22px] font-medium">3</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80">
        <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0 pb-4">
          <CardTitle className="text-[13px] font-medium">Toutes les commandes</CardTitle>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={marche} onValueChange={setMarche}>
              <SelectTrigger className="h-9 w-[140px] text-xs">
                <SelectValue placeholder="Marché" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous marchés</SelectItem>
                <SelectItem value="FR">FR</SelectItem>
                <SelectItem value="BE">BE</SelectItem>
                <SelectItem value="DE">DE</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statut} onValueChange={setStatut}>
              <SelectTrigger className="h-9 w-[140px] text-xs">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="Livré">Livré</SelectItem>
                <SelectItem value="En transit">En transit</SelectItem>
                <SelectItem value="Problème">Problème</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="h-9 w-[220px] text-xs"
              placeholder="Recherche…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((h) => (
                    <TableHead key={h.id} className="text-[10px] uppercase">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-xs">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
