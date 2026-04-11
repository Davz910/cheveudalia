"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export function DashboardAgenda() {
  const [cursor, setCursor] = useState(() => new Date(2026, 3, 10));
  const [selected, setSelected] = useState(() => new Date(2026, 3, 10));

  const monthLabel = format(cursor, "LLLL yyyy", { locale: fr });

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const events = useMemo(() => {
    if (!isSameDay(selected, new Date(2026, 3, 10))) return [];
    return [
      { time: "10:00", title: "Point équipe", type: "Réunion" },
      { time: "14:30", title: "Shooting UGC", type: "Post CM" },
    ];
  }, [selected]);

  return (
    <Card className="flex flex-col overflow-hidden border-border/80 p-0">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
        <span className="text-[13px] font-medium">Agenda</span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-[22px] w-[22px] text-[11px]"
            onClick={() => setCursor((d) => addMonths(d, -1))}
          >
            ‹
          </Button>
          <span className="min-w-[100px] text-center text-[11px] font-medium capitalize">{monthLabel}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-[22px] w-[22px] text-[11px]"
            onClick={() => setCursor((d) => addMonths(d, 1))}
          >
            ›
          </Button>
          <Button type="button" size="sm" className="h-7 bg-primary px-2 text-[10px] text-primary-foreground">
            + Événement
          </Button>
        </div>
      </div>
      <div className="border-b border-border px-3 py-2.5">
        <div className="mb-1 grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-[9px] font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {days.map((day) => {
            const inMonth = isSameMonth(day, cursor);
            const sel = isSameDay(day, selected);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelected(day)}
                className={cn(
                  "rounded-md py-1 text-[11px]",
                  !inMonth && "text-muted-foreground/50",
                  sel && "bg-primary font-medium text-primary-foreground"
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>
      <div className="max-h-[220px] flex-1 overflow-y-auto px-3.5 py-2.5">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {isSameDay(selected, new Date()) ? "Aujourd'hui" : format(selected, "EEEE d MMMM", { locale: fr })}
        </div>
        <div className="flex flex-col gap-2">
          {events.length === 0 ? (
            <div className="text-xs text-muted-foreground">Aucun événement</div>
          ) : (
            events.map((e) => (
              <div key={e.title} className="flex items-start gap-2 text-xs">
                <span className="text-muted-foreground">{e.time}</span>
                <div>
                  <div className="font-medium">{e.title}</div>
                  <div className="text-[11px] text-muted-foreground">{e.type}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
