"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseKanban } from "@/types/projets";

function projectIncludesMember(membres: unknown, memberId: string): boolean {
  if (!Array.isArray(membres)) return false;
  return membres.some((x) => String(x) === memberId);
}

function countAssignedOpenTasks(kanban: unknown, membreId: string): number {
  const k = parseKanban(kanban);
  let n = 0;
  for (const col of ["todo", "inprogress"] as const) {
    for (const t of k[col]) {
      if (t.assign && String(t.assign) === membreId) n += 1;
    }
  }
  return n;
}

export function DashboardWelcome({ prenom, membreId }: { prenom: string; membreId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase.from("projets").select("kanban,membres");
      if (cancelled) return;
      if (error) {
        setCount(0);
        return;
      }
      let total = 0;
      for (const row of (data ?? []) as { kanban: unknown; membres: unknown }[]) {
        if (!projectIncludesMember(row.membres, membreId)) continue;
        total += countAssignedOpenTasks(row.kanban, membreId);
      }
      setCount(total);
    })();

    return () => {
      cancelled = true;
    };
  }, [membreId]);

  const displayCount = count ?? "…";
  const taskPhrase =
    count === 1 ? "nouvelle tâche" : "nouvelles tâches";

  return (
    <div className="mb-5 rounded-lg border border-border/80 bg-card px-4 py-3.5 shadow-sm">
      <p className="text-[15px] leading-snug text-foreground">
        Bonjour {prenom} 👋, tu as <span className="font-semibold tabular-nums">{displayCount}</span> {taskPhrase} à
        gérer
      </p>
      <Link
        href="/dashboard/projets"
        className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-[#D4537E] transition hover:underline"
      >
        → Voir les choses à faire
      </Link>
    </div>
  );
}
