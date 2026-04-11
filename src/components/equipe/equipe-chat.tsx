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
  const fileRef = useRef<HTMLInputElement>(null);
  const msgChannelRef = useRef<RealtimeChannel | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  /* Présence globale */
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
        () => {
          void loadMessages(conv.convId);
        }
      )
      .subscribe();

    msgChannelRef.current = ch;
    return () => {
      void supabase.removeChannel(ch);
      msgChannelRef.current = null;
    };
  }, [conv?.convId, conv, supabase, loadMessages]);

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

  const myProjects = useMemo(
    () => projets.filter((p) => projectIncludesMember(p.membres, currentMembre.id)),
    [projets, currentMembre.id]
  );

  const otherMembers = useMemo(
    () => membres.filter((m) => m.id !== currentMembre.id),
    [membres, currentMembre.id]
  );

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

  const jitsiUrl = conv ? `https://meet.jit.si/cheveudalia-${conv.convId}` : "";

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[230px] shrink-0 flex-col border-r border-border bg-card">
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
                  {otherMembers.map((m) => {
                    const active =
                      conv?.kind === "dm" && conv.peer.id === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => void selectDm(m)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-muted",
                          active && "bg-[hsl(336_56%_95%)] font-medium text-primary"
                        )}
                      >
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            onlineIds.has(m.id) ? "bg-[#639922]" : "bg-muted-foreground/40"
                          )}
                        />
                        <span className="truncate">
                          {m.prenom} {m.nom}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <Separator className="my-3" />
                <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Groupes projets
                </p>
                <div className="space-y-0.5">
                  {myProjects.length === 0 ? (
                    <p className="px-2 text-[11px] text-muted-foreground">Aucun projet</p>
                  ) : (
                    myProjects.map((p) => {
                      const active = conv?.kind === "project" && conv.convId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectProject(p)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-muted",
                            active && "bg-[hsl(336_56%_95%)] font-medium text-primary"
                          )}
                        >
                          <span className="text-[14px]">{p.icon ?? "📁"}</span>
                          <span className="truncate">{p.nom}</span>
                        </button>
                      );
                    })
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
            onClick={() =>
              conv &&
              window.open(`${jitsiUrl}#config.startWithVideoMuted=true`, "_blank", "noopener,noreferrer")
            }
          >
            📞 Appel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            disabled={!conv}
            onClick={() => conv && window.open(jitsiUrl, "_blank", "noopener,noreferrer")}
          >
            📹 Vidéo
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1 p-3">
          {!conv ? (
            <p className="text-xs text-muted-foreground">Choisissez une conversation.</p>
          ) : loadingMsg ? (
            <p className="text-xs text-muted-foreground">Chargement des messages…</p>
          ) : (
            <div className="flex flex-col gap-2">
              {messages.map((msg) => {
                const mine = msg.from_id === currentMembre.id;
                const from = membres.find((x) => x.id === msg.from_id);
                const label = from ? `${from.prenom} ${from.nom}` : "…";
                return (
                  <div
                    key={msg.id}
                    className={cn("flex", mine ? "justify-end" : "justify-start")}
                  >
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
                      <p className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
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
              onChange={(e) => setText(e.target.value)}
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
