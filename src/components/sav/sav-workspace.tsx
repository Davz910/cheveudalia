"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/sav/rich-text-editor";
import { SavNewTicketDialog } from "@/components/sav/sav-new-ticket-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { parseMsgs, type SavMsg, type TicketSavRow } from "@/types/sav";
import { useMediaQuery } from "@/hooks/use-media-query";
import { showUnassignedEmailAlert } from "@/lib/sav/paris-hours";
import { useToast } from "@/hooks/use-toast";

const FILTERS = [
  { id: "actifs", label: "En demande" },
  { id: "resolus", label: "Résolus" },
  { id: "archives", label: "Archivés" },
] as const;

type AgentOption = { id: string; prenom: string; nom: string };

function formatNowTime() {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function ticketMatchesFilt(t: TicketSavRow, filt: (typeof FILTERS)[number]["id"]): boolean {
  const e = (t.etat ?? "").toLowerCase();
  if (filt === "resolus") return e === "resolu";
  if (filt === "archives") return e === "archive";
  return e !== "resolu" && e !== "archive";
}

type ClientRow = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  tel: string | null;
  marche: string | null;
  cmds: number | null;
  total_depense: number | null;
  historique: unknown;
};

export function SavWorkspace({
  currentMembreName,
  canMutate,
}: {
  currentMembreName: string;
  canMutate: boolean;
}) {
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const editorRef = useRef<RichTextEditorHandle>(null);

  const [canal, setCanal] = useState<"email" | "whatsapp">("email");
  const [dossier, setDossier] = useState<"recus" | "envoyes" | "brouillons" | "spam">("recus");
  const [filt, setFilt] = useState<(typeof FILTERS)[number]["id"]>("actifs");
  const [replyTab, setReplyTab] = useState<"rep" | "note">("rep");
  const [search, setSearch] = useState("");

  const [tickets, setTickets] = useState<TicketSavRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [clientFiche, setClientFiche] = useState<ClientRow | null>(null);
  const [signatureHtml, setSignatureHtml] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileConvOpen, setMobileConvOpen] = useState(false);
  const [clientSheetOpen, setClientSheetOpen] = useState(false);
  const isMd = useMediaQuery("(min-width: 768px)");
  /** Recalcul périodique du badge 2h+ (sans attendre un événement Realtime). */
  const [, setAlertTick] = useState(0);

  const selected = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? null,
    [tickets, selectedId]
  );

  const loadTickets = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      const { data, error } = await supabase
        .from("tickets_sav")
        .select("*")
        .eq("canal", "email")
        .order("updated_at", { ascending: false });

      if (error) {
        toast({ title: "Erreur chargement tickets", description: error.message, variant: "destructive" });
        if (!opts?.silent) setLoading(false);
        return;
      }

      const rows = (data ?? []) as TicketSavRow[];
      setTickets(rows);
      if (!opts?.silent) setLoading(false);
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    },
    [supabase, toast]
  );

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (isMd) setMobileConvOpen(false);
  }, [isMd]);

  useEffect(() => {
    const id = setInterval(() => setAlertTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("tickets_sav_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets_sav" },
        () => {
          void loadTickets({ silent: true });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, loadTickets]);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from("membres").select("id,prenom,nom,role").eq("role", "sav");

      if (error || !data?.length) {
        setAgents([]);
        return;
      }

      const names = new Set(["sarah", "leo"]);
      const picked = (data as (AgentOption & { role: string })[]).filter(
        (m) => m.prenom && names.has(m.prenom.trim().toLowerCase())
      );
      picked.sort((a, b) => a.prenom.localeCompare(b.prenom));
      setAgents(picked);
    })();
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      if (!selected?.client_email?.trim()) {
        setClientFiche(null);
        return;
      }
      const email = selected.client_email.trim();
      const { data, error } = await supabase.from("clients").select("*").ilike("email", email).maybeSingle();

      if (error || !data) {
        setClientFiche(null);
        return;
      }
      setClientFiche(data as ClientRow);
    })();
  }, [selected?.client_email, supabase]);

  useEffect(() => {
    void (async () => {
      if (!selected?.assigned_to) {
        setSignatureHtml(null);
        return;
      }
      const { data, error } = await supabase
        .from("membres")
        .select("sav_signature_html")
        .eq("id", selected.assigned_to)
        .maybeSingle();

      if (error || !data) {
        setSignatureHtml(null);
        return;
      }
      setSignatureHtml((data as { sav_signature_html: string | null }).sav_signature_html);
    })();
  }, [selected?.assigned_to, supabase]);

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (!ticketMatchesFilt(t, filt)) return false;
      if (!q) return true;
      return (
        (t.sujet ?? "").toLowerCase().includes(q) ||
        (t.client_nom ?? "").toLowerCase().includes(q) ||
        (t.client_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [tickets, filt, search]);

  async function createTicket(payload: {
    client_nom: string;
    client_email: string;
    client_tel: string;
    sujet: string;
  }) {
    if (!canMutate) return { error: "Permission refusée." };
    const { error } = await supabase.from("tickets_sav").insert({
      canal: "email",
      statut: "ouvert",
      etat: "actif",
      client_nom: payload.client_nom || null,
      client_email: payload.client_email,
      client_tel: payload.client_tel || null,
      sujet: payload.sujet,
      msgs: [],
    });
    if (error) return { error: error.message };
    await loadTickets();
    return {};
  }

  async function appendMessage(ticketId: string, newMsg: SavMsg) {
    const { data: row, error: fetchErr } = await supabase
      .from("tickets_sav")
      .select("msgs")
      .eq("id", ticketId)
      .single();

    if (fetchErr) {
      toast({ title: "Envoi impossible", description: fetchErr.message, variant: "destructive" });
      return;
    }

    const current = parseMsgs(row?.msgs);
    const next = [...current, newMsg];
    const { error } = await supabase.from("tickets_sav").update({ msgs: next }).eq("id", ticketId);
    if (error) {
      toast({ title: "Envoi impossible", description: error.message, variant: "destructive" });
      return;
    }
    await loadTickets({ silent: true });
  }

  async function handleSend() {
    if (!canMutate || !selected) return;
    const html = editorRef.current?.getHtml() ?? "";
    const text = editorRef.current?.getText() ?? "";
    if (!text) {
      toast({ title: "Message vide", description: "Saisissez un texte avant d’envoyer." });
      return;
    }
    setSending(true);
    const h = formatNowTime();
    const msg: SavMsg =
      replyTab === "rep"
        ? { d: "out", t: html || text, h, agent: currentMembreName }
        : { d: "internal", t: html || text, h, agent: currentMembreName };
    await appendMessage(selected.id, msg);
    editorRef.current?.clear();
    setSending(false);
    toast({ title: replyTab === "rep" ? "Réponse enregistrée" : "Note enregistrée" });
  }

  async function assignTo(agentId: string) {
    if (!canMutate || !selected) return;
    const { error } = await supabase.from("tickets_sav").update({ assigned_to: agentId }).eq("id", selected.id);
    if (error) {
      toast({ title: "Assignation impossible", description: error.message, variant: "destructive" });
      return;
    }
    await loadTickets();
    toast({ title: "Ticket assigné" });
  }

  async function setEtat(etat: "resolu" | "archive") {
    if (!canMutate || !selected) return;
    const { error } = await supabase.from("tickets_sav").update({ etat }).eq("id", selected.id);
    if (error) {
      toast({ title: "Mise à jour impossible", description: error.message, variant: "destructive" });
      return;
    }
    await loadTickets();
    toast({ title: etat === "resolu" ? "Ticket résolu" : "Ticket archivé" });
  }

  const msgs = parseMsgs(selected?.msgs);

  const clientFicheBody =
    !selected?.client_email ? (
      <p className="text-muted-foreground">Pas d’email sur ce ticket.</p>
    ) : !clientFiche ? (
      <p className="text-muted-foreground">Aucun client trouvé pour {selected.client_email}</p>
    ) : (
      <div className="space-y-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Identité</div>
          <div className="font-medium">
            {clientFiche.prenom} {clientFiche.nom}
          </div>
          <div className="text-muted-foreground">{clientFiche.email}</div>
          {clientFiche.tel ? <div className="text-muted-foreground">{clientFiche.tel}</div> : null}
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Marché</div>
          <div>{clientFiche.marche ?? "—"}</div>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Stats</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Commandes</span>
            <span className="font-medium">{clientFiche.cmds ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total dépensé</span>
            <span className="font-medium">{clientFiche.total_depense ?? 0} €</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Historique</div>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-[10px]">
            {JSON.stringify(clientFiche.historique ?? [], null, 2)}
          </pre>
        </div>
      </div>
    );

  return (<div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex shrink-0 items-center justify-end gap-2 border-b border-border px-3 py-2">
        <Button
          type="button"
          size="sm"
          className="h-8 bg-primary text-xs text-primary-foreground"
          disabled={!canMutate}
          onClick={() => setNewOpen(true)}
        >
          + Nouveau ticket
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 border-b border-border">
          <button
            type="button"
            className={cn(
              "flex-1 py-2 text-center text-xs",
              canal === "email"
                ? "border-b-2 border-primary font-medium text-primary"
                : "text-muted-foreground"
            )}
            onClick={() => setCanal("email")}
          >
            Email
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 py-2 text-center text-xs",
              canal === "whatsapp"
                ? "border-b-2 border-primary font-medium text-primary"
                : "text-muted-foreground"
            )}
            onClick={() => setCanal("whatsapp")}
          >
            WhatsApp
          </button>
        </div>
        {(() => {
          if (canal !== "email") {
            return (
              <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
                Canal WhatsApp — à brancher sur{" "}
                <code className="mx-1 text-foreground">tickets_sav</code> (canal = whatsapp).
              </div>
            );
          }
          return (
            <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            "flex w-full shrink-0 flex-col border-r border-border md:w-[240px]",
            mobileConvOpen && "hidden md:flex"
          )}
        >
          <div className="grid grid-cols-2 border-b border-border sm:grid-cols-4">
            {(
              [
                ["recus", "📥", "Reçus"],
                ["envoyes", "📤", "Envoyés"],
                ["brouillons", "📝", "Brouillons"],
                ["spam", "⚠️", "Spam"],
              ] as const
            ).map(([id, icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDossier(id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[9px]",
                  dossier === id
                    ? "border-b-2 border-primary bg-[hsl(336_56%_95%)] font-medium text-primary"
                    : "text-muted-foreground"
                )}
              >
                <span className="text-[13px]">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="border-b border-border p-2">
            <input
              className="mb-1.5 w-full rounded-md border border-border px-2 py-1 text-[11px]"
              placeholder="Rechercher client, sujet, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilt(f.id)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px]",
                    filt === f.id
                      ? "border-primary bg-[hsl(336_56%_95%)] text-primary"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-1 text-[10px] text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5">Tous</span>
              <span className="rounded-full px-2 py-0.5">Mes tickets</span>
              <span className="rounded-full px-2 py-0.5">Libres</span>
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-1">
              {loading ? (
                <div className="p-3 text-center text-xs text-muted-foreground">Chargement…</div>
              ) : filteredTickets.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">Aucun ticket</div>
              ) : (
                filteredTickets.map((t) => {
                  const alert2h = showUnassignedEmailAlert(t.created_at, t.assigned_to);
                  const active = t.id === selectedId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(t.id);
                        if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
                          setMobileConvOpen(true);
                        }
                      }}
                      className={cn(
                        "mb-px w-full rounded-md border border-transparent px-2.5 py-2.5 text-left text-xs transition-colors hover:bg-muted",
                        active && "border-primary/20 bg-[hsl(336_56%_95%)]"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium">{t.client_nom ?? t.client_email ?? "—"}</span>
                            {alert2h ? (
                              <Badge variant="destructive" className="shrink-0 px-1.5 py-0 text-[9px]">
                                2h+
                              </Badge>
                            ) : null}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">{t.sujet ?? "Sans objet"}</div>
                          <div className="mt-1 flex items-center gap-1">
                            <Badge variant="blue" className="text-[9px]">
                              email
                            </Badge>
                            {t.etat ? (
                              <span className="text-[10px] text-muted-foreground">{t.etat}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col border-r border-border",
            !mobileConvOpen && "hidden md:flex"
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 px-2 text-xs md:hidden"
                onClick={() => setMobileConvOpen(false)}
              >
                ← Retour
              </Button>
              <div className="min-w-0">
              <div className="truncate text-sm font-medium">{selected?.sujet ?? "Conversation"}</div>
              {selected ? (
                <div className="truncate text-[10px] text-muted-foreground">
                  {selected.client_email} · mis à jour{" "}
                  {new Date(selected.updated_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </div>
              ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] md:hidden"
                disabled={!selected?.client_email}
                onClick={() => setClientSheetOpen(true)}
              >
                Voir fiche
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!canMutate || !selected}>
                    Assigner
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {agents.length === 0 ? (
                    <DropdownMenuItem disabled>Aucun agent Sarah/Leo</DropdownMenuItem>
                  ) : (
                    agents.map((a) => (
                      <DropdownMenuItem key={a.id} onClick={() => void assignTo(a.id)}>
                        {a.prenom} {a.nom}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-[#639922] bg-[#EAF3DE] text-[11px] text-[#3B6D11]"
                disabled={!canMutate || !selected}
                onClick={() => void setEtat("resolu")}
              >
                Résoudre
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                disabled={!canMutate || !selected}
                onClick={() => void setEtat("archive")}
              >
                Archiver
              </Button>
            </div>
          </div>
          <div className="border-b border-border px-3.5 py-1.5 text-[11px] text-muted-foreground">
            Canal email — assignation Sarah / Leo. Temps réel activé sur <code className="text-foreground">tickets_sav</code>.
          </div>
          <ScrollArea className="min-h-0 flex-1 p-3">
            {!selected ? (
              <div className="text-xs text-muted-foreground">Sélectionnez un ticket.</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {msgs.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Aucun message — premier contact à venir.</div>
                ) : (
                  msgs.map((m, i) => (
                    <div
                      key={`${i}-${m.h}`}
                      className={cn(
                        "flex flex-col gap-0.5",
                        m.d === "out" && "items-end",
                        m.d === "in" && "items-start",
                        m.d === "internal" && "items-stretch"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[86%] rounded-xl px-2.5 py-1.5 text-xs leading-relaxed",
                          m.d === "out" && "bg-primary text-primary-foreground",
                          m.d === "in" && "bg-muted text-foreground",
                          m.d === "internal" && "border border-amber-200 bg-amber-50 text-foreground"
                        )}
                      >
                        {m.d === "internal" ? (
                          <div className="mb-1 text-[10px] font-medium text-amber-800">Note interne · {m.agent}</div>
                        ) : null}
                        <div
                          className="max-w-none break-words [&_a]:text-inherit [&_a]:underline"
                          dangerouslySetInnerHTML={{ __html: m.t }}
                        />
                      </div>
                      <div className="px-1 text-[10px] text-muted-foreground">
                        {m.h}
                        {m.agent && m.d !== "internal" ? ` · ${m.agent}` : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </ScrollArea>
          <div className="border-t border-border p-3">
            <div className="mb-2 flex gap-0.5">
              <button
                type="button"
                onClick={() => setReplyTab("rep")}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px]",
                  replyTab === "rep" ? "bg-[hsl(336_56%_95%)] font-medium text-primary" : "text-muted-foreground"
                )}
              >
                Répondre
              </button>
              <button
                type="button"
                onClick={() => setReplyTab("note")}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px]",
                  replyTab === "note" ? "bg-[hsl(336_56%_95%)] font-medium text-primary" : "text-muted-foreground"
                )}
              >
                Note interne
              </button>
            </div>
            <RichTextEditor
              ref={editorRef}
              disabled={!canMutate || !selected}
              placeholder={replyTab === "rep" ? "Rédigez votre réponse…" : "Note interne…"}
            />
            <div className="mt-2 border-t border-border bg-muted/50 px-2 py-1.5 text-[10px] text-muted-foreground">
              {signatureHtml ? (
                <div className="text-foreground [&_a]:text-primary" dangerouslySetInnerHTML={{ __html: signatureHtml }} />
              ) : selected?.assigned_to ? (
                <span>Pas de signature enregistrée pour l’agent assigné.</span>
              ) : (
                <span>Assignez le ticket pour afficher la signature SAV.</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                className="h-8 bg-primary text-xs text-primary-foreground"
                disabled={!canMutate || !selected || sending}
                onClick={() => void handleSend()}
              >
                {sending ? "Envoi…" : "Envoyer"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!canMutate || !selected}>
                    Transférer
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {agents.map((a) => (
                    <DropdownMenuItem key={a.id} onClick={() => void assignTo(a.id)}>
                      {a.prenom} {a.nom}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="ml-auto text-[10px] text-muted-foreground">via Email</span>
            </div>
          </div>
        </div>

        <div className="hidden w-[200px] shrink-0 flex-col md:flex">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <span className="truncate text-sm font-medium">Fiche client</span>
            <Badge variant="pink">CRM</Badge>
          </div>
          <ScrollArea className="min-h-0 flex-1 p-3 text-xs">
            {clientFicheBody}
          </ScrollArea>
        </div>

        <Sheet open={clientSheetOpen} onOpenChange={setClientSheetOpen}>
          <SheetContent side="right" className="flex w-[min(100vw,360px)] flex-col gap-0 p-0 sm:max-w-md">
            <SheetHeader className="border-b border-border px-4 py-3 text-left">
              <SheetTitle className="text-base">Fiche client</SheetTitle>
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1 p-4 text-xs">
              {clientFicheBody}
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
          );
        })()}
      </div>

      <SavNewTicketDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={() => void loadTickets()}
        createTicket={createTicket}
      />
    </div>);
}
