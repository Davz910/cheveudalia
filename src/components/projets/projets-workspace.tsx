"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import {
  findTaskColumn,
  insertTaskInColumn,
  removeTaskFromKanban,
  resolveDropColumn,
} from "@/lib/projets/kanban-dnd";
import {
  type KanbanColumnId,
  type KanbanState,
  type KanbanTask,
  type ProjetRow,
  type TaskFile,
  KANBAN_COLUMNS,
  computeProgress,
  parseKanban,
  parseMembreIds,
  parseProjetFiles,
} from "@/types/projets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, ImageIcon } from "lucide-react";

type MembreLite = { id: string; prenom: string; nom: string };

const COL_LABELS: Record<KanbanColumnId, string> = {
  todo: "À faire",
  inprogress: "En cours",
  done: "Terminé",
};

function safeName(n: string) {
  return n.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

function DroppableCol({
  id,
  title,
  color,
  children,
}: {
  id: KanbanColumnId;
  title: string;
  color?: string | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[320px] min-w-[260px] max-w-[88vw] shrink-0 flex-col rounded-lg border border-border bg-card/50 md:max-w-none md:flex-1",
        isOver && "ring-2 ring-primary/40"
      )}
    >
      <div
        className="border-b border-border px-3 py-2 text-[12px] font-medium"
        style={color ? { borderLeftWidth: 3, borderLeftColor: color } : undefined}
      >
        {title}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">{children}</div>
    </div>
  );
}

function DraggableTask({
  task,
  isCreator,
  onOpen,
  onApprove,
  onRefuse,
}: {
  task: KanbanTask;
  isCreator: boolean;
  onOpen: () => void;
  onApprove: () => void;
  onRefuse: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border border-border bg-background p-2 text-xs shadow-sm",
        isDragging && "z-10 opacity-60"
      )}
    >
      <div className="flex gap-1.5">
        <button
          type="button"
          className="cursor-grab touch-none px-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Déplacer"
          {...listeners}
          {...attributes}
        >
          ⋮⋮
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" className="w-full text-left font-medium" onClick={onOpen}>
            {task.titre}
          </button>
          <div className="mt-1 flex flex-wrap gap-1">
            {task.prio ? (
              <Badge variant="outline" className="text-[9px]">
                {task.prio}
              </Badge>
            ) : null}
            {task.pendingVal ? (
              <Badge variant="amber" className="text-[9px]">
                En attente validation
              </Badge>
            ) : null}
            {(task.fichiers?.length ?? 0) > 0 ? (
              <Badge variant="secondary" className="text-[9px]">
                {task.fichiers!.length} fichier(s)
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
      {task.pendingVal && isCreator ? (
        <div className="mt-2 flex gap-1 border-t border-border pt-2" onPointerDown={(e) => e.stopPropagation()}>
          <Button type="button" size="sm" className="h-7 flex-1 text-[10px]" onClick={onApprove}>
            Approuver
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 flex-1 text-[10px]" onClick={onRefuse}>
            Refuser
          </Button>
        </div>
      ) : null}
    </div>
  );
}

type AggregatedFile = TaskFile & { source: "projet" | "tâche"; taskTitre?: string; taskId?: string };

export function ProjetsWorkspace({
  currentMembreId,
  currentMembreName,
}: {
  currentMembreId: string;
  currentMembreName: string;
}) {
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [projets, setProjets] = useState<ProjetRow[]>([]);
  const [selected, setSelected] = useState<ProjetRow | null>(null);
  const [kanban, setKanban] = useState<KanbanState>({ todo: [], inprogress: [], done: [] });
  const [membres, setMembres] = useState<MembreLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDrag, setActiveDrag] = useState<KanbanTask | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTaskCol, setNewTaskCol] = useState<KanbanColumnId | null>(null);
  const [taskSheet, setTaskSheet] = useState<KanbanTask | null>(null);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [refuseNote, setRefuseNote] = useState("");
  const [refuseTargetId, setRefuseTargetId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<TaskFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loadProjets = useCallback(async () => {
    const { data, error } = await supabase.from("projets").select("*").order("nom");
    if (error) {
      toast({ title: "Projets", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setProjets((data ?? []) as ProjetRow[]);
    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    void loadProjets();
    void (async () => {
      const { data } = await supabase.from("membres").select("id,prenom,nom").order("prenom");
      setMembres((data ?? []) as MembreLite[]);
    })();
  }, [loadProjets, supabase]);

  useEffect(() => {
    const ch = supabase
      .channel("projets_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projets" },
        () => {
          void loadProjets();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, loadProjets]);

  useEffect(() => {
    if (!selected) {
      setKanban({ todo: [], inprogress: [], done: [] });
      return;
    }
    setKanban(parseKanban(selected.kanban));
  }, [selected]);

  useEffect(() => {
    if (!previewFile) {
      setPreviewUrl(null);
      return;
    }
    void (async () => {
      const { data, error } = await supabase.storage
        .from("project-files")
        .createSignedUrl(previewFile.url, 3600);
      if (error || !data?.signedUrl) {
        setPreviewUrl(null);
        return;
      }
      setPreviewUrl(data.signedUrl);
    })();
  }, [previewFile, supabase]);

  const selectProjet = useCallback((p: ProjetRow) => {
    setSelected(p);
    setKanban(parseKanban(p.kanban));
  }, []);

  useEffect(() => {
    if (!selected?.id) return;
    const fresh = projets.find((x) => x.id === selected.id);
    if (fresh) {
      setSelected(fresh);
      setKanban(parseKanban(fresh.kanban));
    }
  }, [projets, selected?.id]);

  const persistKanban = useCallback(
    async (next: KanbanState) => {
      if (!selected) return;
      const progress = computeProgress(next);
      const { error } = await supabase
        .from("projets")
        .update({ kanban: next, progress })
        .eq("id", selected.id);
      if (error) {
        toast({ title: "Sauvegarde impossible", description: error.message, variant: "destructive" });
        return;
      }
      setKanban(next);
      setSelected((prev) => (prev ? { ...prev, kanban: next as unknown as ProjetRow["kanban"], progress } : null));
      void loadProjets();
    },
    [selected, supabase, toast, loadProjets]
  );

  const isCreator = selected?.createur === currentMembreId;

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    const t = findTaskInState(kanban, id);
    setActiveDrag(t);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over || !selected) return;
    const activeId = String(active.id);
    const overIdStr = String(over.id);

    const sourceCol = findTaskColumn(kanban, activeId);
    if (!sourceCol) return;

    let targetCol = resolveDropColumn(kanban, overIdStr);
    if (!targetCol) return;

    if (sourceCol === targetCol && overIdStr === activeId) return;

    const { next: without, task } = removeTaskFromKanban(kanban, activeId);
    if (!task) return;

    let t = { ...task };
    const creator = selected.createur === currentMembreId;

    if (targetCol === "done" && !creator) {
      t = { ...t, pendingVal: true, refuseNote: t.refuseNote ?? "" };
      const merged = insertTaskInColumn(without, "inprogress", t);
      void persistKanban(merged);
      toast({ title: "Validation requise", description: "Le créateur du projet doit approuver le passage en Terminé." });
      return;
    }

    if (targetCol === "done" && creator) {
      t = { ...t, pendingVal: false };
    }

    let insertIndex = without[targetCol].length;
    if (!KANBAN_COLUMNS.includes(overIdStr as KanbanColumnId)) {
      const idx = without[targetCol].findIndex((x) => x.id === overIdStr);
      if (idx >= 0) insertIndex = idx;
    }

    const merged = insertTaskInColumn(without, targetCol, t, insertIndex);
    void persistKanban(merged);
  };

  const projectMembers = useMemo(() => {
    if (!selected) return [];
    const ids = parseMembreIds(selected.membres);
    const map = new Map(membres.map((m) => [m.id, m]));
    return ids.map((id) => map.get(id)).filter(Boolean) as MembreLite[];
  }, [selected, membres]);

  const allFiles = useMemo((): AggregatedFile[] => {
    if (!selected) return [];
    const fromProj = parseProjetFiles(selected.fichiers).map((f) => ({ ...f, source: "projet" as const }));
    const fromTasks: AggregatedFile[] = [];
    for (const col of KANBAN_COLUMNS) {
      for (const task of kanban[col]) {
        for (const f of task.fichiers ?? []) {
          fromTasks.push({
            ...f,
            source: "tâche",
            taskTitre: task.titre,
            taskId: task.id,
          });
        }
      }
    }
    return [...fromProj, ...fromTasks];
  }, [selected, kanban]);

  async function handleCreateProject(payload: {
    nom: string;
    icon: string;
    desc: string;
    marche: string;
    deadline: string;
    color: string;
    membresIds: string[];
  }) {
    const { error } = await supabase.from("projets").insert({
      nom: payload.nom,
      icon: payload.icon || null,
      description: payload.desc || null,
      marche: payload.marche || null,
      deadline: payload.deadline || null,
      color: payload.color || null,
      statut: "actif",
      membres: payload.membresIds,
      createur: currentMembreId,
      progress: 0,
      kanban: { todo: [], inprogress: [], done: [] },
      fichiers: [],
    });
    if (error) {
      toast({ title: "Création impossible", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Projet créé" });
    setCreateOpen(false);
    void loadProjets();
  }

  function openNewTask(col: KanbanColumnId) {
    setNewTaskCol(col);
  }

  function confirmNewTask(titre: string) {
    if (!newTaskCol || !titre.trim()) return;
    const task: KanbanTask = {
      id: crypto.randomUUID(),
      titre: titre.trim(),
      prio: "normale",
      assign: null,
      fichiers: [],
      pendingVal: false,
      refuseNote: "",
    };
    const next = insertTaskInColumn(kanban, newTaskCol, task);
    void persistKanban(next);
    setNewTaskCol(null);
  }

  function updateTaskInKanban(taskId: string, updater: (t: KanbanTask) => KanbanTask) {
    const next: KanbanState = {
      todo: kanban.todo.map((t) => (t.id === taskId ? updater({ ...t }) : t)),
      inprogress: kanban.inprogress.map((t) => (t.id === taskId ? updater({ ...t }) : t)),
      done: kanban.done.map((t) => (t.id === taskId ? updater({ ...t }) : t)),
    };
    void persistKanban(next);
  }

  function approveTask(taskId: string) {
    const { next: w, task: removed } = removeTaskFromKanban(kanban, taskId);
    if (!removed) return;
    const clean = { ...removed, pendingVal: false, refuseNote: "" };
    const merged = insertTaskInColumn(w, "done", clean);
    void persistKanban(merged);
  }

  function startRefuse(taskId: string) {
    setRefuseTargetId(taskId);
    setRefuseNote("");
    setRefuseOpen(true);
  }

  function confirmRefuse() {
    if (!refuseTargetId || !refuseNote.trim()) {
      toast({ title: "Note obligatoire", description: "Indiquez une note de refus.", variant: "destructive" });
      return;
    }
    updateTaskInKanban(refuseTargetId, (t) => ({
      ...t,
      pendingVal: false,
      refuseNote: refuseNote.trim(),
    }));
    setRefuseOpen(false);
    setRefuseTargetId(null);
  }

  async function uploadTaskFile(taskId: string, file: File, desc: string) {
    if (!selected || !desc.trim()) return;
    const path = `${selected.id}/${taskId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const { error: upErr } = await supabase.storage.from("project-files").upload(path, file);
    if (upErr) {
      toast({ title: "Upload", description: upErr.message, variant: "destructive" });
      return;
    }
    const f: TaskFile = {
      id: crypto.randomUUID(),
      nom: file.name,
      desc: desc.trim(),
      type: file.type || "application/octet-stream",
      taille: `${(file.size / 1024).toFixed(1)} Ko`,
      date: new Date().toLocaleDateString("fr-FR"),
      auteur: currentMembreName,
      url: path,
    };
    updateTaskInKanban(taskId, (t) => ({
      ...t,
      fichiers: [...(t.fichiers ?? []), f],
    }));
    toast({ title: "Fichier ajouté" });
  }

  async function uploadProjetFile(file: File, desc: string) {
    if (!selected || !desc.trim()) return;
    const path = `${selected.id}/_projet/${crypto.randomUUID()}-${safeName(file.name)}`;
    const { error: upErr } = await supabase.storage.from("project-files").upload(path, file);
    if (upErr) {
      toast({ title: "Upload", description: upErr.message, variant: "destructive" });
      return;
    }
    const f: TaskFile = {
      id: crypto.randomUUID(),
      nom: file.name,
      desc: desc.trim(),
      type: file.type || "application/octet-stream",
      taille: `${(file.size / 1024).toFixed(1)} Ko`,
      date: new Date().toLocaleDateString("fr-FR"),
      auteur: currentMembreName,
      url: path,
    };
    const list = parseProjetFiles(selected.fichiers);
    const nextFiles = [...list, f];
    const { error } = await supabase
      .from("projets")
      .update({ fichiers: nextFiles })
      .eq("id", selected.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    setSelected((prev) => (prev ? { ...prev, fichiers: nextFiles as unknown as ProjetRow["fichiers"] } : null));
    void loadProjets();
    toast({ title: "Fichier projet ajouté" });
  }

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <div className="hidden w-[220px] shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-[13px] font-medium">Projets</span>
          <Button type="button" size="sm" className="h-7 bg-primary px-2 text-[11px]" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-3 w-3" />
            Nouveau
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-2">
            {loading ? (
              <p className="p-2 text-xs text-muted-foreground">Chargement…</p>
            ) : projets.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">Aucun projet</p>
            ) : (
              projets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProjet(p)}
                  className={cn(
                    "mb-1 w-full rounded-md border border-transparent px-2 py-2 text-left text-xs transition-colors hover:bg-muted",
                    selected?.id === p.id && "border-primary/30 bg-[hsl(336_56%_95%)] font-medium"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span>{p.icon ?? "📁"}</span>
                    <span className="truncate">{p.nom}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {p.deadline ? `Échéance ${p.deadline}` : "Pas d’échéance"} · {p.progress ?? 0}%
                  </div>
                  {p.statut ? (
                    <Badge variant="outline" className="mt-1 text-[9px]">
                      {p.statut}
                    </Badge>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[hsl(60_5%_96%)]">
        <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-card p-2 md:hidden">
          <Select
            value={selected?.id ?? ""}
            onValueChange={(v) => {
              const p = projets.find((x) => x.id === v);
              if (p) selectProjet(p);
            }}
          >
            <SelectTrigger className="h-9 w-full text-xs">
              <SelectValue placeholder="Choisir un projet" />
            </SelectTrigger>
            <SelectContent>
              {projets.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {(p.icon ?? "📁") + " " + p.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            className="h-8 w-full bg-primary text-[11px] text-primary-foreground"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            Nouveau projet
          </Button>
        </div>
        {!selected ? (
          <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            Sélectionnez un projet
          </div>
        ) : (
          <>
            <div className="border-b border-border bg-card px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="truncate text-lg font-medium">
                  {selected.icon} {selected.nom}
                </span>
                <Progress value={selected.progress ?? 0} className="h-2 max-w-[200px]" />
                <span className="text-xs text-muted-foreground">{selected.progress ?? 0}%</span>
              </div>
              {selected.description ? (
                <p className="mt-2 text-xs text-muted-foreground">{selected.description}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-[11px] text-muted-foreground">Membres :</span>
                {projectMembers.map((m) => (
                  <Badge key={m.id} variant="secondary" className="text-[10px]">
                    {m.prenom} {m.nom}
                  </Badge>
                ))}
              </div>
            </div>

            <Tabs defaultValue="kanban" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mx-4 mt-3 w-fit">
                <TabsTrigger value="kanban" className="text-xs">
                  Kanban
                </TabsTrigger>
                <TabsTrigger value="fichiers" className="text-xs">
                  Fichiers
                </TabsTrigger>
              </TabsList>
              <TabsContent value="kanban" className="min-h-0 flex-1 overflow-hidden px-0 pb-4 pt-2 md:px-4">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <div className="-mx-1 overflow-x-auto px-3 pb-1 md:mx-0 md:overflow-visible md:px-0">
                  <div className="flex h-full min-h-[400px] gap-3">
                    {(KANBAN_COLUMNS as readonly KanbanColumnId[]).map((col) => (
                      <DroppableCol key={col} id={col} title={COL_LABELS[col]} color={selected.color}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 justify-start text-[11px] text-primary"
                          onClick={() => openNewTask(col)}
                        >
                          + Tâche
                        </Button>
                        {kanban[col].map((task) => (
                          <DraggableTask
                            key={task.id}
                            task={task}
                            isCreator={!!isCreator}
                            onOpen={() => setTaskSheet(task)}
                            onApprove={() => approveTask(task.id)}
                            onRefuse={() => startRefuse(task.id)}
                          />
                        ))}
                      </DroppableCol>
                    ))}
                  </div>
                  </div>
                  <DragOverlay>
                    {activeDrag ? (
                      <div className="rounded-md border bg-background p-2 text-xs shadow-lg">{activeDrag.titre}</div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </TabsContent>
              <TabsContent value="fichiers" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
                <div className="mb-4 flex justify-end">
                  <ProjetFileButton onUpload={(f, d) => void uploadProjetFile(f, d)} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {allFiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucun fichier</p>
                  ) : (
                    allFiles.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setPreviewFile(f)}
                        className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition hover:ring-2 hover:ring-primary/30"
                      >
                        <div className="flex h-28 items-center justify-center bg-muted/40">
                          {f.type.startsWith("image/") ? (
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          ) : (
                            <FileText className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="p-2">
                          <div className="truncate text-[11px] font-medium">{f.nom}</div>
                          <div className="text-[10px] text-muted-foreground">{f.desc}</div>
                          <Badge variant="outline" className="mt-1 text-[9px]">
                            {f.source}
                            {f.taskTitre ? ` · ${f.taskTitre}` : ""}
                          </Badge>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        membres={membres}
        currentMembreId={currentMembreId}
        onCreate={handleCreateProject}
      />

      <Dialog open={!!newTaskCol} onOpenChange={() => setNewTaskCol(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle tâche — {newTaskCol ? COL_LABELS[newTaskCol] : ""}</DialogTitle>
          </DialogHeader>
          <NewTaskForm onSubmit={confirmNewTask} onCancel={() => setNewTaskCol(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={refuseOpen} onOpenChange={setRefuseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Note de refus</DialogTitle>
          </DialogHeader>
          <Textarea value={refuseNote} onChange={(e) => setRefuseNote(e.target.value)} rows={3} placeholder="Motif…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefuseOpen(false)}>
              Annuler
            </Button>
            <Button onClick={confirmRefuse}>Confirmer le refus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.nom}</DialogTitle>
          </DialogHeader>
          {previewUrl && previewFile?.type.startsWith("image/") ? (
            <img src={previewUrl} alt="" className="max-h-[70vh] w-full object-contain" />
          ) : previewUrl && previewFile?.type === "application/pdf" ? (
            <iframe src={previewUrl} title="pdf" className="h-[70vh] w-full rounded-md border" />
          ) : (
            <p className="text-sm text-muted-foreground">Aperçu non disponible — type : {previewFile?.type}</p>
          )}
        </DialogContent>
      </Dialog>

      <TaskDetailSheet
        open={!!taskSheet}
        onOpenChange={(o) => {
          if (!o) setTaskSheet(null);
        }}
        task={taskSheet}
        membres={membres}
        projetId={selected?.id ?? null}
        onSave={(t) => {
          updateTaskInKanban(t.id, () => t);
          setTaskSheet(null);
        }}
        onUploadFile={(file, desc) => taskSheet && void uploadTaskFile(taskSheet.id, file, desc)}
      />
    </div>
  );
}

function findTaskInState(k: KanbanState, id: string): KanbanTask | null {
  for (const col of KANBAN_COLUMNS) {
    const t = k[col].find((x) => x.id === id);
    if (t) return t;
  }
  return null;
}

function NewTaskForm({ onSubmit, onCancel }: { onSubmit: (t: string) => void; onCancel: () => void }) {
  const [v, setV] = useState("");
  return (
    <>
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="Titre de la tâche" />
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button onClick={() => onSubmit(v)}>Créer</Button>
      </DialogFooter>
    </>
  );
}

function CreateProjectDialog({
  open,
  onOpenChange,
  membres,
  currentMembreId,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  membres: MembreLite[];
  currentMembreId: string;
  onCreate: (p: {
    nom: string;
    icon: string;
    desc: string;
    marche: string;
    deadline: string;
    color: string;
    membresIds: string[];
  }) => void;
}) {
  const [nom, setNom] = useState("");
  const [icon, setIcon] = useState("📁");
  const [desc, setDesc] = useState("");
  const [marche, setMarche] = useState("");
  const [deadline, setDeadline] = useState("");
  const [color, setColor] = useState("#D4537E");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setNom("");
      setIcon("📁");
      setDesc("");
      setMarche("");
      setDeadline("");
      setColor("#D4537E");
      setPicked(new Set([currentMembreId]));
    }
  }, [open, currentMembreId]);

  function toggle(id: string) {
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau projet</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Nom</Label>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div>
            <Label>Icône (emoji)</Label>
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Marché</Label>
            <Input value={marche} onChange={(e) => setMarche(e.target.value)} placeholder="FR, BE…" />
          </div>
          <div>
            <Label>Deadline</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div>
            <Label>Couleur</Label>
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label>Membres</Label>
            <ScrollArea className="h-32 rounded-md border p-2">
              {membres.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-center gap-2 py-1 text-xs">
                  <input type="checkbox" checked={picked.has(m.id)} onChange={() => toggle(m.id)} />
                  {m.prenom} {m.nom}
                </label>
              ))}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={!nom.trim()}
            onClick={() =>
              onCreate({
                nom: nom.trim(),
                icon,
                desc,
                marche,
                deadline,
                color,
                membresIds: Array.from(picked),
              })
            }
          >
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailSheet({
  open,
  onOpenChange,
  task,
  membres,
  projetId,
  onSave,
  onUploadFile,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: KanbanTask | null;
  membres: MembreLite[];
  projetId: string | null;
  onSave: (t: KanbanTask) => void;
  onUploadFile: (file: File, desc: string) => void;
}) {
  const [titre, setTitre] = useState("");
  const [prio, setPrio] = useState("normale");
  const [assign, setAssign] = useState<string | "">("");
  const [fileDesc, setFileDesc] = useState("");

  useEffect(() => {
    if (task) {
      setTitre(task.titre);
      setPrio(task.prio ?? "normale");
      setAssign(task.assign ?? "");
      setFileDesc("");
    }
  }, [task]);

  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Tâche</SheetTitle>
        </SheetHeader>
        <div className="mt-4 grid gap-3">
          <div>
            <Label>Titre</Label>
            <Input value={titre} onChange={(e) => setTitre(e.target.value)} />
          </div>
          <div>
            <Label>Priorité</Label>
            <Select value={prio} onValueChange={setPrio}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basse">Basse</SelectItem>
                <SelectItem value="normale">Normale</SelectItem>
                <SelectItem value="haute">Haute</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Assigné</Label>
            <Select value={assign || "__none__"} onValueChange={(v) => setAssign(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Non assigné</SelectItem>
                {membres.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.prenom} {m.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {task.refuseNote ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[11px]">
              <strong>Refus :</strong> {task.refuseNote}
            </div>
          ) : null}
          <Separator />
          <div>
            <Label>Fichiers</Label>
            <ul className="mt-1 space-y-1 text-[11px]">
              {(task.fichiers ?? []).map((f) => (
                <li key={f.id} className="truncate text-muted-foreground">
                  {f.nom} — {f.desc}
                </li>
              ))}
            </ul>
            {projetId ? (
              <div className="mt-2 space-y-2">
                <Input placeholder="Description du fichier (obligatoire)" value={fileDesc} onChange={(e) => setFileDesc(e.target.value)} />
                <input
                  type="file"
                  className="text-xs"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && fileDesc.trim()) onUploadFile(f, fileDesc);
                    e.target.value = "";
                  }}
                />
              </div>
            ) : null}
          </div>
          <Button
            onClick={() =>
              onSave({
                ...task,
                titre: titre.trim() || task.titre,
                prio,
                assign: assign || null,
              })
            }
          >
            Enregistrer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ProjetFileButton({ onUpload }: { onUpload: (f: File, d: string) => void }) {
  const [desc, setDesc] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <Label className="text-[10px]">Description</Label>
        <Input className="h-8 w-48 text-xs" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Obligatoire" />
      </div>
      <input
        type="file"
        className="text-xs"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && desc.trim()) onUpload(f, desc);
          e.target.value = "";
        }}
      />
    </div>
  );
}
