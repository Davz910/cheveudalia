"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dmThreadIdForPair } from "@/lib/chat/dm-thread";

function projectIncludesMember(membres: unknown, memberId: string): boolean {
  if (!Array.isArray(membres)) return false;
  return membres.some((x) => String(x) === memberId);
}

/** Identifiants de toutes les conversations DM + projets accessibles au membre courant. */
export function useEquipeConversationIds(currentMembreId: string | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const [convIds, setConvIds] = useState<string[]>([]);

  useEffect(() => {
    if (!currentMembreId) {
      setConvIds([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [mRes, pRes] = await Promise.all([
        supabase.from("membres").select("id").neq("id", currentMembreId),
        supabase.from("projets").select("id,membres"),
      ]);
      if (cancelled) return;
      const others = ((mRes.data ?? []) as { id: string }[]).map((x) => x.id);
      const dmIds: string[] = [];
      for (const oid of others) {
        dmIds.push(await dmThreadIdForPair(currentMembreId, oid));
      }
      const projRows = (pRes.data ?? []) as { id: string; membres: unknown }[];
      const pIds = projRows.filter((p) => projectIncludesMember(p.membres, currentMembreId)).map((p) => p.id);
      setConvIds([...dmIds, ...pIds]);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentMembreId, supabase]);

  return convIds;
}
