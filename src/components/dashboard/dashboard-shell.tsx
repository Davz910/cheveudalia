"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ModuleKey, Role } from "@/lib/roles";
import { ROLE_LABELS, modulesForRole } from "@/lib/roles";
import { logoutAction } from "@/app/actions/auth";
import { NotificationBell } from "@/components/dashboard/notification-bell";

const SIDEBAR_COLLAPSED_KEY = "cheveudalia-dashboard-sidebar-collapsed";

const NAV: {
  section: string;
  items: { href: string; label: string; key: ModuleKey; icon: string; badge?: number }[];
}[] = [
  {
    section: "Principal",
    items: [
      { href: "/dashboard", label: "Dashboard", key: "dashboard", icon: "home" },
      { href: "/dashboard/commandes", label: "Commandes", key: "commandes", icon: "shopping_cart", badge: 12 },
      { href: "/dashboard/produits", label: "Produits & stocks", key: "produits", icon: "storefront" },
      { href: "/dashboard/clients", label: "Clients CRM", key: "clients", icon: "group" },
    ],
  },
  {
    section: "Opérations",
    items: [
      { href: "/dashboard/sav", label: "SAV", key: "sav", icon: "support_agent", badge: 4 },
      { href: "/dashboard/logistique", label: "Logistique", key: "logistique", icon: "local_shipping" },
      { href: "/dashboard/marketing", label: "Marketing", key: "marketing", icon: "campaign" },
      { href: "/dashboard/contenus", label: "Contenus & CM", key: "contenus", icon: "photo_camera_back" },
      { href: "/dashboard/influenceurs", label: "Influenceurs & UGC", key: "influenceurs", icon: "star" },
    ],
  },
  {
    section: "Équipe",
    items: [
      { href: "/dashboard/equipe", label: "Équipe & chat", key: "equipe", icon: "chat_bubble" },
      { href: "/dashboard/finances", label: "Finances P&L", key: "finances", icon: "account_balance" },
      { href: "/dashboard/assistant", label: "Assistant IA ✦", key: "assistant", icon: "robot_2" },
      { href: "/dashboard/projets", label: "Projets", key: "projets", icon: "folder_open" },
    ],
  },
  {
    section: "Admin",
    items: [
      { href: "/dashboard/membres", label: "Membres & RH", key: "membres", icon: "badge" },
      { href: "/dashboard/configuration", label: "Configuration", key: "configuration", icon: "settings" },
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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") {
        setSidebarCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={cn(
          "flex shrink-0 flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-200 ease-in-out",
          sidebarCollapsed ? "w-[52px]" : "w-[220px]"
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center gap-2.5 border-b border-border p-4",
            sidebarCollapsed && "justify-center px-2 py-3"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground">
            C
          </div>
          {!sidebarCollapsed ? (
            <div className="min-w-0">
              <div className="text-[13px] font-medium leading-tight">Cheveudalia</div>
              <div className="text-[11px] text-muted-foreground">Espace de gestion</div>
            </div>
          ) : null}
        </div>
        {!sidebarCollapsed ? (
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
        ) : null}
        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1.5 pb-2">
          {visibleNav.map((group) => (
            <div key={group.section} className="mt-1.5">
              {!sidebarCollapsed ? (
                <div className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                  {group.section}
                </div>
              ) : null}
              {group.items.map((item) => {
                const active =
                  item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
                const linkClass = cn(
                  "group mb-px flex cursor-pointer items-center gap-2 rounded-md py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  sidebarCollapsed ? "justify-center px-1.5" : "px-3",
                  active && "bg-[hsl(336_56%_95%)] font-medium text-[hsl(336_45%_35%)]",
                  !active && "font-normal"
                );
                const iconClass = cn(
                  "material-icons shrink-0 select-none text-[20px] leading-none",
                  active ? "text-[#D4537E]" : "text-muted-foreground group-hover:text-foreground"
                );
                const linkInner = (
                  <>
                    <span className={iconClass} aria-hidden>
                      {item.icon}
                    </span>
                    {!sidebarCollapsed ? (
                      <>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.badge != null ? (
                          <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                            {item.badge}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </>
                );
                if (sidebarCollapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <Link href={item.href} className={linkClass}>
                          {linkInner}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                return (
                  <Link key={item.href} href={item.href} className={linkClass}>
                    {linkInner}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div
          className={cn(
            "shrink-0 border-t border-border p-2",
            sidebarCollapsed && "flex justify-center px-1.5 py-2"
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-9 text-muted-foreground hover:text-foreground", !sidebarCollapsed && "w-full")}
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Développer la navigation" : "Réduire la navigation"}
          >
            <span className="material-icons text-[20px] leading-none">
              {sidebarCollapsed ? "chevron_right" : "chevron_left"}
            </span>
          </Button>
        </div>
        <form
          action={logoutAction}
          className={cn("mt-auto border-t border-border p-2.5", sidebarCollapsed && "flex justify-center px-1.5")}
        >
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="submit"
                  className="flex cursor-pointer items-center justify-center rounded-md p-1.5 hover:bg-muted"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
                    {initials(membre.prenom, membre.nom)}
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Déconnexion · {membre.prenom} {membre.nom}
              </TooltipContent>
            </Tooltip>
          ) : (
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
          )}
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
