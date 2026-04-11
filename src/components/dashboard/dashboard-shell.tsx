"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ModuleKey, Role } from "@/lib/roles";
import { ROLE_LABELS, modulesForRole } from "@/lib/roles";
import { logoutAction } from "@/app/actions/auth";
import { NotificationBell } from "@/components/dashboard/notification-bell";

const NAV: { section: string; items: { href: string; label: string; key: ModuleKey; badge?: number }[] }[] = [
  {
    section: "Principal",
    items: [
      { href: "/dashboard", label: "Dashboard", key: "dashboard" },
      { href: "/dashboard/commandes", label: "Commandes", key: "commandes", badge: 12 },
      { href: "/dashboard/produits", label: "Produits & stocks", key: "produits" },
      { href: "/dashboard/clients", label: "Clients CRM", key: "clients" },
    ],
  },
  {
    section: "Opérations",
    items: [
      { href: "/dashboard/sav", label: "SAV", key: "sav", badge: 4 },
      { href: "/dashboard/logistique", label: "Logistique", key: "logistique" },
      { href: "/dashboard/marketing", label: "Marketing", key: "marketing" },
      { href: "/dashboard/contenus", label: "Contenus & CM", key: "contenus" },
      { href: "/dashboard/influenceurs", label: "Influenceurs & UGC", key: "influenceurs" },
    ],
  },
  {
    section: "Équipe",
    items: [
      { href: "/dashboard/equipe", label: "Équipe & chat", key: "equipe" },
      { href: "/dashboard/finances", label: "Finances P&L", key: "finances" },
      { href: "/dashboard/assistant", label: "Assistant IA ✦", key: "assistant" },
      { href: "/dashboard/projets", label: "Projets", key: "projets" },
    ],
  },
  {
    section: "Admin",
    items: [
      { href: "/dashboard/membres", label: "Membres & RH", key: "membres" },
      { href: "/dashboard/configuration", label: "Configuration", key: "configuration" },
    ],
  },
];

const ROLE_TABS: Role[] = ["gerant", "sav", "logistique", "marketing", "cm"];

function initials(prenom: string, nom: string) {
  const a = prenom?.[0] ?? "";
  const b = nom?.[0] ?? "";
  return (a + b).toUpperCase() || "??";
}

export function DashboardShell({
  membre,
  children,
  title,
  marketLabel = "🇫🇷 France",
}: {
  membre: { prenom: string; nom: string; role: Role };
  children: React.ReactNode;
  title?: string;
  marketLabel?: string;
}) {
  const pathname = usePathname();
  const allowed = modulesForRole(membre.role);

  const visibleNav = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => allowed.includes(i.key)),
  })).filter((g) => g.items.length > 0);

  const PAGE_TITLES: Record<string, string> = {
    "/dashboard": "Vue générale",
    "/dashboard/commandes": "Commandes",
    "/dashboard/produits": "Produits & stocks",
    "/dashboard/clients": "Clients CRM",
    "/dashboard/sav": "SAV",
    "/dashboard/logistique": "Logistique & Suivi colis",
    "/dashboard/marketing": "Marketing",
    "/dashboard/contenus": "Contenus & CM",
    "/dashboard/influenceurs": "Influenceurs & UGC",
    "/dashboard/equipe": "Équipe & chat",
    "/dashboard/finances": "Finances & Pockets",
    "/dashboard/assistant": "Assistant IA",
    "/dashboard/projets": "Projets",
    "/dashboard/membres": "Membres & RH",
    "/dashboard/configuration": "Configuration",
  };

  const resolvedTitle =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k + "/"))?.[1] ??
    title ??
    "Vue générale";

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center gap-2.5 border-b border-border p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground">
            C
          </div>
          <div>
            <div className="text-[13px] font-medium leading-tight">Cheveudalia</div>
            <div className="text-[11px] text-muted-foreground">Espace de gestion</div>
          </div>
        </div>
        <div className="m-2.5">
          <Select defaultValue="fr">
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Marché" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">🇫🇷 France</SelectItem>
              <SelectItem value="de">🇩🇪 Allemagne</SelectItem>
              <SelectItem value="it">🇮🇹 Italie</SelectItem>
              <SelectItem value="all">🌍 Tous les marchés</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <nav className="flex-1 overflow-y-auto px-1.5 pb-2">
          {visibleNav.map((group) => (
            <div key={group.section} className="mt-1.5">
              <div className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                {group.section}
              </div>
              {group.items.map((item) => {
                const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "mb-px flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      active && "bg-[hsl(336_56%_95%)] font-medium text-[hsl(336_45%_35%)]",
                      !active && "font-normal"
                    )}
                  >
                    <span className="opacity-70">◻</span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge != null ? (
                      <span className="rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <form action={logoutAction} className="mt-auto border-t border-border p-2.5">
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md p-1.5 text-left hover:bg-muted"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
              {initials(membre.prenom, membre.nom)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">
                {membre.prenom} {membre.nom.charAt(0)}.
              </div>
              <div className="text-[11px] text-muted-foreground">
                {ROLE_LABELS[membre.role]} · Accès
              </div>
            </div>
          </button>
        </form>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[hsl(60_5%_96%)]">
        <div className="flex shrink-0 gap-0.5 border-b border-border bg-card px-5 pt-2.5">
          {ROLE_TABS.map((r) => (
            <div
              key={r}
              className={cn(
                "cursor-default border-b-2 border-transparent px-3.5 pb-2 text-xs",
                membre.role === r
                  ? "border-primary font-medium text-primary"
                  : "text-muted-foreground"
              )}
            >
              {ROLE_LABELS[r]}
            </div>
          ))}
        </div>
        <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-card px-5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="truncate text-[15px] font-medium">{resolvedTitle}</div>
          </div>
          <Badge variant="pink" className="font-medium">
            {marketLabel}
          </Badge>
          <Button variant="outline" size="sm" className="h-8 text-xs">
            Exporter
          </Button>
          <Button size="sm" className="h-8 bg-primary text-xs text-primary-foreground hover:bg-primary/90">
            + Nouvelle action
          </Button>
          <NotificationBell />
        </header>
        <div className="flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
