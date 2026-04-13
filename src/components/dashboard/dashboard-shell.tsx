"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
import { SidebarNavItems } from "@/components/dashboard/sidebar-nav-items";
import { EquipeGlobalMessageToasts } from "@/components/equipe/equipe-global-message-toasts";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu } from "lucide-react";

const SIDEBAR_COLLAPSED_KEY = "cheveudalia-dashboard-sidebar-collapsed";

const NAV: {
  section: string;
  items: {
    href: string;
    label: string;
    key: ModuleKey;
    icon: string;
    badge?: number;
  }[];
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
      { href: "/dashboard/sav/email", label: "SAV Email", key: "sav", icon: "mail" },
      { href: "/dashboard/sav/whatsapp", label: "SAV WhatsApp", key: "sav", icon: "call" },
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
      { href: "/dashboard/assistant", label: "Assistant IA ✦", key: "assistant", icon: "smart_toy" },
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
  membre: { id: string; prenom: string; nom: string; role: Role; avatar_url?: string | null };
  children: React.ReactNode;
  title?: string;
  marketLabel?: string;
}) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const allowed = modulesForRole(membre.role);
  const canSeeEquipe = allowed.includes("equipe");
  const canSeeSav = allowed.includes("sav");
  const [equipeUnreadCount, setEquipeUnreadCount] = useState(0);
  const [savEmailBadge, setSavEmailBadge] = useState(0);
  const [savWhatsappBadge, setSavWhatsappBadge] = useState(0);

  const visibleNav = useMemo(() => {
    const mod = modulesForRole(membre.role);
    return NAV.map((g) => ({
      ...g,
      items: g.items
        .filter((i) => mod.includes(i.key))
        .map((i) => {
          if (i.href === "/dashboard/sav/email") {
            return { ...i, badge: savEmailBadge > 0 ? savEmailBadge : undefined };
          }
          if (i.href === "/dashboard/sav/whatsapp") {
            return { ...i, badge: savWhatsappBadge > 0 ? savWhatsappBadge : undefined };
          }
          return i;
        }),
    })).filter((g) => g.items.length > 0);
  }, [membre.role, savEmailBadge, savWhatsappBadge]);

  const PAGE_TITLES: Record<string, string> = {
    "/dashboard": "Vue générale",
    "/dashboard/commandes": "Commandes",
    "/dashboard/produits": "Produits & stocks",
    "/dashboard/clients": "Clients CRM",
    "/dashboard/sav/email": "SAV Email",
    "/dashboard/sav/whatsapp": "SAV WhatsApp",
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

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

  const refreshEquipeUnread = useCallback(async () => {
    if (!membre.id || !canSeeEquipe) return;
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", membre.id)
      .eq("canal", "equipe")
      .eq("read", false);
    if (!error && typeof count === "number") {
      setEquipeUnreadCount(count);
    }
  }, [membre.id, canSeeEquipe, supabase]);

  const markEquipeNotificationsRead = useCallback(async () => {
    if (!membre.id) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", membre.id)
      .eq("canal", "equipe")
      .eq("read", false);
    if (!error) {
      setEquipeUnreadCount(0);
    }
  }, [membre.id, supabase]);

  const refreshSavBadges = useCallback(async () => {
    if (!canSeeSav) return;
    const [emailRes, waRes] = await Promise.all([
      supabase
        .from("tickets_sav")
        .select("*", { count: "exact", head: true })
        .eq("canal", "email")
        .neq("etat", "archive"),
      supabase
        .from("tickets_sav")
        .select("*", { count: "exact", head: true })
        .eq("canal", "whatsapp")
        .neq("etat", "archive"),
    ]);
    if (!emailRes.error && typeof emailRes.count === "number") {
      setSavEmailBadge(emailRes.count);
    }
    if (!waRes.error && typeof waRes.count === "number") {
      setSavWhatsappBadge(waRes.count);
    }
  }, [canSeeSav, supabase]);

  useEffect(() => {
    if (!canSeeSav) return;
    void refreshSavBadges();
    const channel = supabase
      .channel("dashboard-sav-badges")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets_sav" },
        () => {
          void refreshSavBadges();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canSeeSav, supabase, refreshSavBadges]);

  useEffect(() => {
    if (!membre.id || !canSeeEquipe) return;
    void refreshEquipeUnread();
    const channel = supabase
      .channel(`notifications-equipe-${membre.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${membre.id}`,
        },
        () => {
          void refreshEquipeUnread();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [membre.id, canSeeEquipe, supabase, refreshEquipeUnread]);

  return (
    <div className="flex h-screen overflow-hidden">
      <EquipeGlobalMessageToasts currentMembreId={membre.id} />
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="flex w-[min(100vw,280px)] max-w-[90vw] flex-col gap-0 overflow-hidden border-r bg-card p-0"
        >
          <div className="flex shrink-0 items-center gap-2.5 border-b border-border p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground">
              C
            </div>
            <div className="min-w-0">
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
          <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1.5 pb-2">
            <SidebarNavItems
              pathname={pathname}
              visibleNav={visibleNav}
              sidebarCollapsed={false}
              equipeUnreadCount={equipeUnreadCount}
              onEquipeNav={markEquipeNotificationsRead}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </nav>
          <form action={logoutAction} className="mt-auto border-t border-border p-2.5">
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center gap-2 rounded-md p-1.5 text-left hover:bg-muted"
            >
              <Avatar className="h-7 w-7 shrink-0">
                {membre.avatar_url ? (
                  <AvatarImage src={membre.avatar_url} alt="" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-primary text-[11px] font-medium text-primary-foreground">
                  {initials(membre.prenom, membre.nom)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">
                  {membre.prenom} {membre.nom.charAt(0)}.
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {ROLE_LABELS[membre.role]} · Déconnexion
                </div>
              </div>
            </button>
          </form>
        </SheetContent>
      </Sheet>

      <aside
        className={cn(
          "hidden shrink-0 flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-200 ease-in-out md:flex",
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
          <SidebarNavItems
            pathname={pathname}
            visibleNav={visibleNav}
            sidebarCollapsed={sidebarCollapsed}
            equipeUnreadCount={equipeUnreadCount}
            onEquipeNav={markEquipeNotificationsRead}
          />
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
            <span className="material-icons text-[14px] leading-none">
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
                  <Avatar className="h-7 w-7 shrink-0">
                    {membre.avatar_url ? (
                      <AvatarImage src={membre.avatar_url} alt="" className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-primary text-[11px] font-medium text-primary-foreground">
                      {initials(membre.prenom, membre.nom)}
                    </AvatarFallback>
                  </Avatar>
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
              <Avatar className="h-7 w-7 shrink-0">
                {membre.avatar_url ? (
                  <AvatarImage src={membre.avatar_url} alt="" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-primary text-[11px] font-medium text-primary-foreground">
                  {initials(membre.prenom, membre.nom)}
                </AvatarFallback>
              </Avatar>
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
        <header className="relative flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-card px-3 md:gap-3 md:px-5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative z-10 h-9 shrink-0 md:hidden"
            aria-label="Ouvrir le menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground">
              C
            </div>
          </div>
          <div className="hidden min-w-0 flex-1 flex-col gap-0.5 md:flex">
            <div className="truncate text-[15px] font-medium">{resolvedTitle}</div>
          </div>
          <div className="relative z-10 ml-auto flex shrink-0 items-center gap-2 md:gap-3">
            <Badge variant="pink" className="hidden font-medium md:inline-flex">
              {marketLabel}
            </Badge>
            <Button variant="outline" size="sm" className="hidden h-8 text-xs md:inline-flex">
              Exporter
            </Button>
            <Button
              size="sm"
              className="hidden h-8 bg-primary text-xs text-primary-foreground hover:bg-primary/90 md:inline-flex"
            >
              + Nouvelle action
            </Button>
            <NotificationBell />
          </div>
        </header>
        <div className="flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
