"use client";

import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ModuleKey } from "@/lib/roles";

export type SidebarNavGroup = {
  section: string;
  items: { href: string; label: string; key: ModuleKey; icon: string; badge?: number }[];
};

type SidebarNavItemsProps = {
  pathname: string;
  visibleNav: SidebarNavGroup[];
  sidebarCollapsed: boolean;
  equipeUnreadCount: number;
  onEquipeNav?: () => void;
  /** Fermer le menu mobile (Sheet) après navigation */
  onNavigate?: () => void;
};

export function SidebarNavItems({
  pathname,
  visibleNav,
  sidebarCollapsed,
  equipeUnreadCount,
  onEquipeNav,
  onNavigate,
}: SidebarNavItemsProps) {
  return (
    <>
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
            const isEquipe = item.key === "equipe";
            const equipeHasUnread = isEquipe && equipeUnreadCount > 0;
            const equipeIcon = equipeHasUnread ? "mark_chat_unread" : "chat_bubble";
            const linkClass = cn(
              "group mb-px flex cursor-pointer items-center gap-2 rounded-md py-1 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              sidebarCollapsed ? "justify-center px-1.5" : "px-3",
              active && "bg-[hsl(336_56%_95%)] font-medium text-[hsl(336_45%_35%)]",
              !active && "font-normal"
            );
            const iconClass = cn(
              "material-icons shrink-0 select-none text-[14px] leading-none",
              isEquipe && equipeHasUnread
                ? "text-[#D4537E]"
                : active
                  ? "text-[#D4537E]"
                  : "text-muted-foreground group-hover:text-foreground"
            );
            const onNavClick = () => {
              if (isEquipe) void onEquipeNav?.();
              onNavigate?.();
            };
            const linkInner = (
              <>
                {isEquipe ? (
                  <span className="relative inline-flex shrink-0">
                    <span className={iconClass} aria-hidden>
                      {equipeIcon}
                    </span>
                    {equipeHasUnread ? (
                      <span className="pointer-events-none absolute -right-1.5 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-600 px-0.5 text-[8px] font-bold leading-none text-white">
                        {equipeUnreadCount > 99 ? "99+" : equipeUnreadCount}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className={iconClass} aria-hidden>
                    {item.icon}
                  </span>
                )}
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
            const linkLabel =
              isEquipe && equipeHasUnread
                ? `${item.label} (${equipeUnreadCount} non ${equipeUnreadCount > 1 ? "lus" : "lu"})`
                : item.label;
            const a11yLabel = sidebarCollapsed || (isEquipe && equipeHasUnread) ? linkLabel : undefined;
            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={linkClass}
                      onClick={onNavClick}
                      aria-label={a11yLabel}
                    >
                      {linkInner}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {linkLabel}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return (
              <Link key={item.href} href={item.href} className={linkClass} onClick={onNavClick} aria-label={a11yLabel}>
                {linkInner}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
