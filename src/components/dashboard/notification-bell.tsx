"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [filterSav, setFilterSav] = useState(true);
  const [filterMsg, setFilterMsg] = useState(true);
  const [filterAll, setFilterAll] = useState(true);

  return (
    <div className="relative ml-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative h-[34px] w-[34px] text-base"
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
      >
        🔔
        <span className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
          0
        </span>
      </Button>
      {open ? (
        <div
          className={cn(
            "absolute right-0 top-12 z-50 flex max-h-[80vh] w-[340px] flex-col overflow-hidden rounded-md border border-border bg-card shadow-lg"
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3.5 py-3">
            <span className="text-[13px] font-medium">Notifications</span>
            <div className="flex items-center gap-2">
              <button type="button" className="text-[11px] text-muted-foreground hover:underline">
                Tout marquer lu
              </button>
              <button type="button" className="text-muted-foreground" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 border-b border-border px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <Switch checked={filterSav} onCheckedChange={setFilterSav} />
              <span className="text-[11px] text-muted-foreground">Tickets SAV</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={filterMsg} onCheckedChange={setFilterMsg} />
              <span className="text-[11px] text-muted-foreground">Messages équipe</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Switch checked={filterAll} onCheckedChange={setFilterAll} />
              <span className="text-[11px] text-muted-foreground">Tout</span>
            </div>
          </div>
          <ScrollArea className="max-h-[min(360px,50vh)]">
            <div className="p-5 text-center text-xs text-muted-foreground">Aucune notification</div>
          </ScrollArea>
          <div className="shrink-0 border-t border-border p-2.5">
            <button
              type="button"
              className="w-full rounded-md border border-border py-1.5 text-[11px] text-muted-foreground hover:bg-muted"
            >
              Effacer toutes les notifications
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
