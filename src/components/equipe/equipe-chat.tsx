"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { dmThreadIdForPair, sortMemberPair } from "@/lib/chat/dm-thread";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Paperclip } from "lucide-react";

type MembreRow = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
};

type ProjetRow = {
  id: string;
  nom: string;
  icon: string | null;
  membres: unknown;
};

type MessageRow = {
  id: string;
  conv_id: string;
  from_id: string | null;
  texte: string | null;
  fichier_url: string | null;
  created_at: string;
};

type Conv =
  | { kind: "dm"; convId: string; label: string; peer: MembreRow }
  | { kind: "project"; convId: string; label: string; projet: ProjetRow };

const READ_MSG_STORAGE = "cheveudalia_equipe_last_read_msg";

function readMsgMap(): Record<string, string> {
  try {
    const r = typeof window !== "undefined" ? localStorage.getItem(READ_MSG_STORAGE) : null;
    return r ? (JSON.parse(r) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function setReadMsgId(convId: string, msgId: string) {
  try {
    const m = readMsgMap();
    m[convId] = msgId;
    localStorage.setItem(READ_MSG_STORAGE, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

function projectIncludesMember(membres: unknown, memberId: string): boolean {
  if (!Array.isArray(membres)) return false;
  return membres.some((x) => String(x) === memberId);
}

function parseProjectMemberIds(membres: unknown): string[] {
  if (!Array.isArray(membres)) return [];
  return membres.map((x) => String(x)).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
}

function initials(p: string, n: string) {
  return `${p?.[0] ?? ""}${n?.[0] ?? ""}`.toUpperCase() || "?";
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 180);
}

/** Messages système d'appel Jitsi (texte en base) */
const RE_APPEL_AUDIO = /^📞 APPEL_AUDIO:(.+)$/;
const RE_APPEL_VIDEO = /^📹 APPEL_VIDEO:(.+)$/;

type CallInviteKind = "audio" | "video";

function parseCallInviteText(texte: string | null): { kind: CallInviteKind; convId: string } | null {
  if (!texte) return null;
  const t = texte.trim();
  const a = RE_APPEL_AUDIO.exec(t);
  if (a?.[1]) return { kind: "audio", convId: a[1].trim() };
  const v = RE_APPEL_VIDEO.exec(t);
  if (v?.[1]) return { kind: "video", convId: v[1].trim() };
  return null;
}

function jitsiMeetUrl(convId: string, kind: CallInviteKind): string {
  const room = `https://meet.jit.si/cheveudalia-${convId}`;
  if (kind === "audio") {
    return `${room}#config.startWithVideoMuted=true&config.startWithAudioMuted=false`;
  }
  return `${room}#config.startWithVideoMuted=false&config.startWithAudioMuted=false`;
}

function previewSnippet(msg: MessageRow): string {
  const invite = parseCallInviteText(msg.texte);
  if (invite) {
    return invite.kind === "audio" ? "📞 Appel audio" : "📹 Appel vidéo";
  }
  if (msg.fichier_url) {
    const n = msg.texte?.trim() || "fichier";
    return `Fichier : ${n}`.slice(0, 40);
  }
  return (msg.texte ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
}

function formatPreviewLine(msg: MessageRow | undefined, fromMe: boolean): string {
  if (!msg) return "";
  const s = previewSnippet(msg);
  if (!s) return "";
  return fromMe ? `Vous : ${s}` : s;
}

function formatShortTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function isConvUnread(convId: string, last: MessageRow | undefined, currentUserId: string): boolean {
  if (!last || last.from_id === currentUserId) return false;
  const readId = readMsgMap()[convId];
  if (!readId) return true;
  return last.id !== readId;
}

function typingSentence(peers: { prenom: string }[]): string {
  if (peers.length === 0) return "";
  const n = peers.map((p) => p.prenom);
  if (n.length === 1) return `${n[0]} est en train d'écrire`;
  if (n.length === 2) return `${n[0]} et ${n[1]} sont en train d'écrire`;
  return `${n.slice(0, -1).join(", ")} et ${n[n.length - 1]} sont en train d'écrire`;
}

export function EquipeChat({ currentMembre }: { currentMembre: MembreRow }) {
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [membres, setMembres] = useState<MembreRow[]>([]);
  const [projets, setProjets] = useState<ProjetRow[]>([]);
  const [conv, setConv] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [previewByConv, setPreviewByConv] = useState<Record<string, MessageRow>>({});
  const [convIds, setConvIds] = useState<string[]>([]);
  const [typingPeers, setTypingPeers] = useState<{ user_id: string; prenom: string }[]>([]);
  const [incomingCallBanner, setIncomingCallBanner] = useState<{
    msgId: string;
    kind: CallInviteKind;
    prenom: string;
    convId: string;
  } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const msgChannelRef = useRef<RealtimeChannel | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const globalMsgChannelRef = useRef<RealtimeChannel | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const convRef = useRef<Conv | null>(null);
  const membresRef = useRef<MembreRow[]>([]);

  useEffect(() => {
    convRef.current = conv;
  }, [conv]);

  useEffect(() => {
    setIncomingCallBanner(null);
  }, [conv?.convId]);
  useEffect(() => {
    membresRef.current = membres;
  }, [membres]);

  const loadLists = useCallback(async () => {
    setLoadingList(true);
    const [mRes, pRes] = await Promise.all([
      supabase.from("membres").select("id,prenom,nom,email").order("prenom"),
      supabase.from("projets").select("id,nom,icon,membres").order("nom"),
    ]);
    if (mRes.error) toast({ title: "Membres", description: mRes.error.message, variant: "destructive" });
    else setMembres((mRes.data ?? []) as MembreRow[]);

    if (pRes.error) toast({ title: "Projets", description: pRes.error.message, variant: "destructive" });
    else setProjets((pRes.data ?? []) as ProjetRow[]);

    setLoadingList(false);
  }, [supabase, toast]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const otherMembers = useMemo(
    () => membres.filter((m) => m.id !== currentMembre.id),
    [membres, currentMembre.id]
  );

  const myProjects = useMemo(
    () => projets.filter((p) => projectIncludesMember(p.membres, currentMembre.id)),
    [projets, currentMembre.id]
  );

  useEffect(() => {
    if (loadingList) return;
    void (async () => {
      const dmIds: string[] = [];
      for (const m of otherMembers) {
        dmIds.push(await dmThreadIdForPair(currentMembre.id, m.id));
      }
      const pIds = myProjects.map((p) => p.id);
      setConvIds([...dmIds, ...pIds]);
    })();
  }, [loadingList, otherMembers, myProjects, currentMembre.id]);

  const loadPreviews = useCallback(async () => {
    if (convIds.length === 0) {
      setPreviewByConv({});
      return;
    }
    const { data, error } = await supabase
      .from("messages")
      .select("id,conv_id,from_id,texte,fichier_url,created_at")
      .in("conv_id", convIds)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Aperçus", description: error.message, variant: "destructive" });
      return;
    }
    const map: Record<string, MessageRow> = {};
    for (const row of (data ?? []) as MessageRow[]) {
      if (!map[row.conv_id]) map[row.conv_id] = row;
    }
    setPreviewByConv(map);
  }, [convIds, supabase, toast]);

  useEffect(() => {
    void loadPreviews();
  }, [loadPreviews]);

  /* Présence globale en ligne */
  useEffect(() => {
    const ch = supabase.channel("presence:equipe", {
      config: { presence: { key: currentMembre.id } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const ids = new Set<string>();
      for (const payloads of Object.values(state)) {
        for (const p of payloads as { user_id?: string }[]) {
          if (p?.user_id) ids.add(p.user_id);
        }
      }
      setOnlineIds(ids);
    });

    void ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ user_id: currentMembre.id, online_at: new Date().toISOString() });
      }
    });

    presenceChannelRef.current = ch;
    return () => {
      void ch.untrack();
      void supabase.removeChannel(ch);
      presenceChannelRef.current = null;
    };
  }, [supabase, currentMembre.id]);

  /* Realtime : nouveaux messages sur toutes les convs → toast + refresh aperçus */
  useEffect(() => {
    if (convIds.length === 0) return;

    if (globalMsgChannelRef.current) {
      void supabase.removeChannel(globalMsgChannelRef.current);
      globalMsgChannelRef.current = null;
    }

    const ch = supabase.channel(`equipe-msgs-global:${currentMembre.id}`);
    const onInsert = (payload: { new: Record<string, unknown> }) => {
      const row = payload.new as MessageRow;
      void loadPreviews();
      if (row.from_id === currentMembre.id) return;
      const open = convRef.current;
      if (open && open.convId === row.conv_id) return;

      const from = membresRef.current.find((x) => x.id === row.from_id);
      const prenom = from?.prenom ?? "Quelqu'un";
      const invite = parseCallInviteText(row.texte);
      if (invite) {
        toast({
          duration: 4000,
          title: (
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-medium text-primary">
                {from ? initials(from.prenom, from.nom) : "?"}
              </span>
              <span className="text-sm font-medium">
                {prenom} vous invite à un appel {invite.kind === "audio" ? "audio" : "vidéo"}
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
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-medium text-primary">
              {from ? initials(from.prenom, from.nom) : "?"}
            </span>
            <span className="text-sm font-medium">
              {prenom} a envoyé un message
            </span>
          </div>
        ),
        description: preview || "…",
      });
    };

    for (const cid of convIds) {
      ch.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conv_id=eq.${cid}`,
        },
        (payload) => onInsert(payload as { new: Record<string, unknown> })
      );
    }

    ch.subscribe();
    globalMsgChannelRef.current = ch;
    return () => {
      void supabase.removeChannel(ch);
      globalMsgChannelRef.current = null;
    };
  }, [convIds, supabase, currentMembre.id, loadPreviews, toast]);

  /* Présence « en train d'écrire » sur la conv ouverte */
  useEffect(() => {
    if (typingIdleTimerRef.current) {
      clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }
    setTypingPeers([]);
    setText((t) => t);

    if (!conv) {
      if (typingChannelRef.current) {
        void supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
      return;
    }

    if (typingChannelRef.current) {
      void supabase.removeChannel(typingChannelRef.current);
      typingChannelRef.current = null;
    }

    const ch = supabase.channel(`typing:${conv.convId}`, {
      config: { presence: { key: currentMembre.id } },
    });

    const syncTyping = () => {
      const state = ch.presenceState();
      const list: { user_id: string; prenom: string }[] = [];
      const seen = new Set<string>();
      for (const payloads of Object.values(state)) {
        for (const raw of payloads as { user_id?: string; prenom?: string; typing?: boolean }[]) {
          if (!raw?.user_id || raw.user_id === currentMembre.id) continue;
          if (raw.typing !== true || !raw.prenom) continue;
          if (seen.has(raw.user_id)) continue;
          seen.add(raw.user_id);
          list.push({ user_id: raw.user_id, prenom: raw.prenom });
        }
      }
      setTypingPeers(list);
    };

    ch.on("presence", { event: "sync" }, syncTyping);
    ch.on("presence", { event: "join" }, syncTyping);
    ch.on("presence", { event: "leave" }, syncTyping);

    void ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          user_id: currentMembre.id,
          prenom: currentMembre.prenom,
          typing: false,
        });
      }
    });

    typingChannelRef.current = ch;
    return () => {
      void ch.untrack();
      void supabase.removeChannel(ch);
      typingChannelRef.current = null;
    };
  }, [conv, supabase, currentMembre.id, currentMembre.prenom]);

  const broadcastTyping = useCallback(
    (isTyping: boolean) => {
      const ch = typingChannelRef.current;
      if (!ch) return;
      void ch.track({
        user_id: currentMembre.id,
        prenom: currentMembre.prenom,
        typing: isTyping,
      });
    },
    [currentMembre.id, currentMembre.prenom]
  );

  const onInputChange = (v: string) => {
    setText(v);
    if (!conv) return;
    broadcastTyping(true);
    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
    typingIdleTimerRef.current = setTimeout(() => {
      broadcastTyping(false);
      typingIdleTimerRef.current = null;
    }, 3000);
  };

  const ensureDmThread = useCallback(
    async (peerId: string) => {
      const [a, b] = sortMemberPair(currentMembre.id, peerId);
      const threadId = await dmThreadIdForPair(currentMembre.id, peerId);

      const { data: existing } = await supabase
        .from("chat_dm_threads")
        .select("id")
        .eq("member_a", a)
        .eq("member_b", b)
        .maybeSingle();

      if (existing?.id) return existing.id as string;

      const { error } = await supabase.from("chat_dm_threads").insert({ id: threadId, member_a: a, member_b: b });
      if (error?.code === "23505") {
        const { data: again } = await supabase
          .from("chat_dm_threads")
          .select("id")
          .eq("member_a", a)
          .eq("member_b", b)
          .single();
        if (again?.id) return again.id as string;
      }
      if (error && error.code !== "23505") {
        toast({ title: "Thread DM", description: error.message, variant: "destructive" });
        const { data: fallback } = await supabase
          .from("chat_dm_threads")
          .select("id")
          .eq("member_a", a)
          .eq("member_b", b)
          .maybeSingle();
        if (fallback?.id) return fallback.id as string;
      }
      return threadId;
    },
    [supabase, currentMembre.id, toast]
  );

  const loadMessages = useCallback(
    async (convId: string) => {
      setLoadingMsg(true);
      const { data, error } = await supabase
        .from("messages")
        .select("id,conv_id,from_id,texte,fichier_url,created_at")
        .eq("conv_id", convId)
        .order("created_at", { ascending: true });

      if (error) {
        toast({ title: "Messages", description: error.message, variant: "destructive" });
        setMessages([]);
      } else {
        setMessages((data ?? []) as MessageRow[]);
      }
      setLoadingMsg(false);
    },
    [supabase, toast]
  );

  useEffect(() => {
    if (msgChannelRef.current) {
      void supabase.removeChannel(msgChannelRef.current);
      msgChannelRef.current = null;
    }
    if (!conv) {
      setMessages([]);
      return;
    }

    void loadMessages(conv.convId);

    const ch = supabase
      .channel(`messages:${conv.convId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conv_id=eq.${conv.convId}`,
        },
        (payload: { eventType?: string; new?: Record<string, unknown> }) => {
          if (payload.eventType === "INSERT" && payload.new) {
            const row = payload.new as MessageRow;
            if (row.from_id && row.from_id !== currentMembre.id) {
              const inv = parseCallInviteText(row.texte);
              if (inv) {
                const from = membresRef.current.find((x) => x.id === row.from_id);
                setIncomingCallBanner({
                  msgId: row.id,
                  kind: inv.kind,
                  prenom: from?.prenom ?? "Quelqu'un",
                  convId: inv.convId,
                });
              }
            }
          }
          void loadMessages(conv.convId);
        }
      )
      .subscribe();

    msgChannelRef.current = ch;
    return () => {
      void supabase.removeChannel(ch);
      msgChannelRef.current = null;
    };
  }, [conv?.convId, conv, supabase, loadMessages, currentMembre.id]);

  /* Marquer comme lu (dernier message vu) */
  useEffect(() => {
    if (!conv || loadingMsg) return;
    const last = messages[messages.length - 1];
    if (last) setReadMsgId(conv.convId, last.id);
  }, [conv, messages, loadingMsg]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function selectDm(peer: MembreRow) {
    const convId = await ensureDmThread(peer.id);
    setConv({
      kind: "dm",
      convId,
      label: `${peer.prenom} ${peer.nom}`.trim(),
      peer,
    });
  }

  function selectProject(p: ProjetRow) {
    setConv({
      kind: "project",
      convId: p.id,
      label: p.icon ? `${p.icon} ${p.nom}` : p.nom,
      projet: p,
    });
  }

  async function sendText() {
    if (!conv || !text.trim()) return;
    broadcastTyping(false);
    if (typingIdleTimerRef.current) {
      clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }
    const { error } = await supabase.from("messages").insert({
      conv_id: conv.convId,
      from_id: currentMembre.id,
      texte: text.trim(),
      fichier_url: null,
    });
    if (error) {
      toast({ title: "Envoi impossible", description: error.message, variant: "destructive" });
      return;
    }
    setText("");
  }

  async function sendFile(file: File) {
    if (!conv || !file.size) return;
    setUploading(true);
    const path = `${conv.convId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error: upErr } = await supabase.storage.from("chat-files").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) {
      toast({ title: "Upload impossible", description: upErr.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { error: msgErr } = await supabase.from("messages").insert({
      conv_id: conv.convId,
      from_id: currentMembre.id,
      texte: file.name,
      fichier_url: path,
    });
    if (msgErr) {
      toast({ title: "Message fichier", description: msgErr.message, variant: "destructive" });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function initiateCall(kind: CallInviteKind) {
    if (!conv) return;
    const texte =
      kind === "audio" ? `📞 APPEL_AUDIO:${conv.convId}` : `📹 APPEL_VIDEO:${conv.convId}`;
    const { error } = await supabase.from("messages").insert({
      conv_id: conv.convId,
      from_id: currentMembre.id,
      texte,
      fichier_url: null,
    });
    if (error) {
      toast({ title: "Appel", description: error.message, variant: "destructive" });
      return;
    }
    window.open(jitsiMeetUrl(conv.convId, kind), "_blank", "noopener,noreferrer");
  }

  const sidebarMembers = useMemo(() => {
    if (!conv) return [];
    if (conv.kind === "dm") {
      return [currentMembre, conv.peer];
    }
    const ids = parseProjectMemberIds(conv.projet.membres);
    const map = new Map(membres.map((m) => [m.id, m]));
    return ids.map((id) => map.get(id)).filter(Boolean) as MembreRow[];
  }, [conv, membres, currentMembre]);

  async function openSignedFile(path: string) {
    const { data, error } = await supabase.storage.from("chat-files").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast({ title: "Lien fichier", description: error?.message ?? "Erreur", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[260px] shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-3.5 py-2.5">
          <span className="text-[13px] font-medium">Messagerie</span>
          <p className="mt-1 text-[10px] text-muted-foreground">DM + groupes projets</p>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-2">
            {loadingList ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">Chargement…</p>
            ) : (
              <>
                <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Messages directs
                </p>
                <div className="space-y-0.5">
                  {otherMembers.map((m) => (
                    <DmRow
                      key={m.id}
                      peer={m}
                      currentUserId={currentMembre.id}
                      active={conv?.kind === "dm" && conv.peer.id === m.id}
                      online={onlineIds.has(m.id)}
                      previewByConv={previewByConv}
                      onSelect={() => void selectDm(m)}
                    />
                  ))}
                </div>
                <Separator className="my-3" />
                <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Groupes projets
                </p>
                <div className="space-y-0.5">
                  {myProjects.length === 0 ? (
                    <p className="px-2 text-[11px] text-muted-foreground">Aucun projet</p>
                  ) : (
                    myProjects.map((p) => (
                      <ProjectRow
                        key={p.id}
                        projet={p}
                        currentUserId={currentMembre.id}
                        active={conv?.kind === "project" && conv.convId === p.id}
                        previewByConv={previewByConv}
                        onSelect={() => selectProject(p)}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3.5 py-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{conv?.label ?? "Conversation"}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            disabled={!conv}
            onClick={() => void initiateCall("audio")}
          >
            📞 Appel audio
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            disabled={!conv}
            onClick={() => void initiateCall("video")}
          >
            📹 Vidéo
          </Button>
        </div>

        {incomingCallBanner ? (
          <div className="border-b border-primary/15 bg-[hsl(336_56%_95%)] px-3.5 py-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] leading-snug text-foreground">
                <span className="font-medium">{incomingCallBanner.prenom}</span>
                {incomingCallBanner.kind === "audio"
                  ? " vous invite à rejoindre un appel audio"
                  : " vous invite à rejoindre un appel vidéo"}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 bg-primary text-[11px] text-primary-foreground"
                  onClick={() => {
                    window.open(
                      jitsiMeetUrl(incomingCallBanner.convId, incomingCallBanner.kind),
                      "_blank",
                      "noopener,noreferrer"
                    );
                    setIncomingCallBanner(null);
                  }}
                >
                  Rejoindre
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-[11px]"
                  onClick={() => setIncomingCallBanner(null)}
                >
                  Ignorer
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <ScrollArea className="min-h-0 flex-1 p-3">
          {!conv ? (
            <p className="text-xs text-muted-foreground">Choisissez une conversation.</p>
          ) : loadingMsg ? (
            <p className="text-xs text-muted-foreground">Chargement des messages…</p>
          ) : (
            <div className="flex flex-col gap-2">
              {messages.map((msg) => {
                const callInvite = !msg.fichier_url ? parseCallInviteText(msg.texte) : null;
                if (callInvite) {
                  return (
                    <CallInviteMessageLine
                      key={msg.id}
                      msg={msg}
                      currentMembreId={currentMembre.id}
                      membres={membres}
                    />
                  );
                }
                const mine = msg.from_id === currentMembre.id;
                const from = membres.find((x) => x.id === msg.from_id);
                const label = from ? `${from.prenom} ${from.nom}` : "…";
                return (
                  <div key={msg.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-xs",
                        mine ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      {!mine ? (
                        <div className="mb-1 text-[10px] font-medium opacity-80">{label}</div>
                      ) : null}
                      {msg.fichier_url ? (
                        <div>
                          {msg.texte ? <p className="mb-1 break-words">{msg.texte}</p> : null}
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={() => void openSignedFile(msg.fichier_url!)}
                          >
                            Ouvrir le fichier
                          </Button>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{msg.texte}</p>
                      )}
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          mine ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}
                      >
                        {new Date(msg.created_at).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        <div className="border-t border-border p-3">
          {typingPeers.length > 0 ? (
            <p className="mb-2 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
              <span>{typingSentence(typingPeers)}</span>
              <span className="inline-flex translate-y-0.5 gap-0.5">
                <span className="equipe-typing-dot font-bold">·</span>
                <span className="equipe-typing-dot font-bold">·</span>
                <span className="equipe-typing-dot font-bold">·</span>
              </span>
            </p>
          ) : null}
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void sendFile(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={!conv || uploading}
              title="Joindre un fichier"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              className="text-xs"
              placeholder="Écrivez un message…"
              value={text}
              disabled={!conv}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendText();
                }
              }}
            />
            <Button
              type="button"
              className="h-9 shrink-0 bg-primary text-xs text-primary-foreground"
              disabled={!conv || !text.trim()}
              onClick={() => void sendText()}
            >
              Envoyer
            </Button>
          </div>
          {uploading ? <p className="mt-1 text-[10px] text-muted-foreground">Envoi du fichier…</p> : null}
        </div>
      </div>

      <div className="flex w-[210px] shrink-0 flex-col border-l border-border bg-card">
        <div className="border-b border-border px-3.5 py-2.5">
          <span className="text-[13px] font-medium">Membres</span>
        </div>
        <ScrollArea className="min-h-0 flex-1 p-2">
          {!conv ? (
            <p className="px-1 text-xs text-muted-foreground">—</p>
          ) : (
            <div className="space-y-2">
              {sidebarMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      onlineIds.has(m.id) ? "bg-[#639922]" : "bg-muted-foreground/40"
                    )}
                  />
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px]">{initials(m.prenom, m.nom)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">
                      {m.prenom} {m.nom}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">{m.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

function CallInviteMessageLine({
  msg,
  currentMembreId,
  membres,
}: {
  msg: MessageRow;
  currentMembreId: string;
  membres: MembreRow[];
}) {
  const invite = parseCallInviteText(msg.texte);
  if (!invite) return null;
  const from = msg.from_id ? membres.find((x) => x.id === msg.from_id) : null;
  const mine = msg.from_id === currentMembreId;
  const kindFr = invite.kind === "audio" ? "audio" : "vidéo";
  const line = mine
    ? `Vous avez lancé un appel ${kindFr}`
    : `${from?.prenom ?? "…"} a lancé un appel ${kindFr}`;
  const time = formatShortTime(msg.created_at);
  return (
    <div className="w-full">
      <Separator />
      <p className="py-2 text-center text-[11px] italic text-muted-foreground">
        {line} — {time}
      </p>
      <Separator />
    </div>
  );
}

function DmRow({
  peer,
  currentUserId,
  active,
  online,
  previewByConv,
  onSelect,
}: {
  peer: MembreRow;
  currentUserId: string;
  active: boolean;
  online: boolean;
  previewByConv: Record<string, MessageRow>;
  onSelect: () => void;
}) {
  const [cid, setCid] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void dmThreadIdForPair(currentUserId, peer.id).then((id) => {
      if (!cancelled) setCid(id);
    });
    return () => {
      cancelled = true;
    };
  }, [peer.id, currentUserId]);

  const last = cid ? previewByConv[cid] : undefined;
  const fromMe = last?.from_id === currentUserId;
  const line = formatPreviewLine(last, fromMe);
  const unread = cid ? isConvUnread(cid, last, currentUserId) : false;
  const time = last ? formatShortTime(last.created_at) : "";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-muted",
        active && "bg-[hsl(336_56%_95%)] ring-1 ring-primary/20"
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-1 h-2 w-2 shrink-0 rounded-full",
            online ? "bg-[#639922]" : "bg-muted-foreground/40"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className={cn("truncate", unread ? "font-semibold text-foreground" : "font-medium")}>
            {peer.prenom} {peer.nom}
          </div>
          <div className="mt-0.5 flex items-start gap-1">
            {unread ? (
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            ) : (
              <span className="mt-1 w-1.5 shrink-0" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              {line ? (
                <p className="truncate text-[10px] leading-snug text-muted-foreground">
                  {line}
                  {time ? <span className="text-muted-foreground/80"> · {time}</span> : null}
                </p>
              ) : (
                <p className="text-[10px] italic text-muted-foreground">Aucun message</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function ProjectRow({
  projet,
  currentUserId,
  active,
  previewByConv,
  onSelect,
}: {
  projet: ProjetRow;
  currentUserId: string;
  active: boolean;
  previewByConv: Record<string, MessageRow>;
  onSelect: () => void;
}) {
  const cid = projet.id;
  const last = previewByConv[cid];
  const fromMe = last?.from_id === currentUserId;
  const line = formatPreviewLine(last, fromMe);
  const unread = isConvUnread(cid, last, currentUserId);
  const time = last ? formatShortTime(last.created_at) : "";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-muted",
        active && "bg-[hsl(336_56%_95%)] ring-1 ring-primary/20"
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-[14px]">{projet.icon ?? "📁"}</span>
        <div className="min-w-0 flex-1">
          <div className={cn("truncate", unread ? "font-semibold" : "font-medium")}>{projet.nom}</div>
          <div className="mt-0.5 flex items-start gap-1">
            {unread ? (
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            ) : (
              <span className="mt-1 w-1.5 shrink-0" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              {line ? (
                <p className="truncate text-[10px] leading-snug text-muted-foreground">
                  {line}
                  {time ? <span className="text-muted-foreground/80"> · {time}</span> : null}
                </p>
              ) : (
                <p className="text-[10px] italic text-muted-foreground">Aucun message</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
