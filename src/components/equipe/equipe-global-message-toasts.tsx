"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEquipeConversationIds } from "@/hooks/use-equipe-conversation-ids";
import { useEquipeOpenConvOptional } from "@/components/equipe/equipe-open-conv-context";

type MessageRow = {
  id: string;
  conv_id: string;
  from_id: string | null;
  texte: string | null;
  fichier_url: string | null;
  created_at: string;
};

const RE_APPEL_AUDIO = /^📞 APPEL_AUDIO:(.+)$/;
const RE_APPEL_VIDEO = /^📹 APPEL_VIDEO:(.+)$/;

function parseCallInviteText(texte: string | null): "audio" | "video" | null {
  if (!texte) return null;
  const t = texte.trim();
  if (RE_APPEL_AUDIO.test(t)) return "audio";
  if (RE_APPEL_VIDEO.test(t)) return "video";
  return null;
}

function initials(p: string, n: string) {
  return `${p?.[0] ?? ""}${n?.[0] ?? ""}`.toUpperCase() || "?";
}

type MembreLite = { id: string; prenom: string; nom: string; avatar_url: string | null };

export function EquipeGlobalMessageToasts({ currentMembreId }: { currentMembreId: string }) {
  const pathname = usePathname();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const convIds = useEquipeConversationIds(currentMembreId);
  const openCtx = useEquipeOpenConvOptional();
  const [membresById, setMembresById] = useState<Record<string, MembreLite>>({});
  const membresRef = useRef(membresById);
  membresRef.current = membresById;

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("membres").select("id,prenom,nom,avatar_url");
      const map: Record<string, MembreLite> = {};
      for (const r of (data ?? []) as MembreLite[]) {
        map[r.id] = r;
      }
      setMembresById(map);
    })();
  }, [supabase]);

  const onInsert = useCallback(
    (row: MessageRow) => {
      if (row.from_id === currentMembreId) return;

      const onEquipePage = pathname === "/dashboard/equipe" || pathname.startsWith("/dashboard/equipe/");
      const openConvId = openCtx?.openConvIdRef.current ?? null;

      if (onEquipePage && openConvId === row.conv_id) {
        return;
      }

      const from = row.from_id ? membresRef.current[row.from_id] : undefined;
      const prenom = from?.prenom ?? "Quelqu'un";
      const invite = parseCallInviteText(row.texte);

      if (invite) {
        toast({
          duration: 4000,
          title: (
            <div className="flex items-center gap-2">
              <span className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-primary/15">
                {from?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={from.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[11px] font-medium text-primary">
                    {from ? initials(from.prenom, from.nom) : "?"}
                  </span>
                )}
              </span>
              <span className="text-sm font-medium">
                {prenom} vous invite à un appel {invite === "audio" ? "audio" : "vidéo"}
              </span>
            </div>
          ),
          description: "Ouvrez la conversation pour rejoindre.",
        });
        return;
      }

      const raw = row.fichier_url ? "Fichier joint" : (row.texte ?? "").replace(/\s+/g, " ").trim();
      const preview = raw.slice(0, 30);

      toast({
        duration: 4000,
        title: (
          <div className="flex items-center gap-2">
            <span className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-primary/15">
              {from?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={from.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[11px] font-medium text-primary">
                  {from ? initials(from.prenom, from.nom) : "?"}
                </span>
              )}
            </span>
            <span className="text-sm font-medium">{prenom} a envoyé un message</span>
          </div>
        ),
        description: preview || "…",
      });
    },
    [currentMembreId, openCtx, pathname, toast]
  );

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (convIds.length === 0) return;

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const ch = supabase.channel(`equipe-msgs-global-app:${currentMembreId}`);

    for (const cid of convIds) {
      ch.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conv_id=eq.${cid}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          onInsert(row);
        }
      );
    }

    void ch.subscribe();
    channelRef.current = ch;
    return () => {
      void supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [convIds, currentMembreId, supabase, onInsert]);

  return null;
}
