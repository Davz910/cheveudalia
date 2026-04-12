export type TaskFile = {
  id: string;
  nom: string;
  desc: string;
  type: string;
  taille: string;
  date: string;
  auteur: string;
  url: string;
};

export type KanbanTask = {
  id: string;
  titre: string;
  prio?: string;
  assign?: string | null;
  fichiers?: TaskFile[];
  pendingVal?: boolean;
  refuseNote?: string;
};

export type KanbanState = {
  todo: KanbanTask[];
  inprogress: KanbanTask[];
  done: KanbanTask[];
};

export const KANBAN_COLUMNS = ["todo", "inprogress", "done"] as const;
export type KanbanColumnId = (typeof KANBAN_COLUMNS)[number];

export type ProjetRow = {
  id: string;
  nom: string;
  icon: string | null;
  description: string | null;
  marche: string | null;
  deadline: string | null;
  statut: string | null;
  color: string | null;
  membres: unknown;
  progress: number | null;
  createur: string | null;
  kanban: unknown;
  fichiers: unknown;
  created_at: string;
};

export function parseKanban(raw: unknown): KanbanState {
  const empty: KanbanState = { todo: [], inprogress: [], done: [] };
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const col = (k: string): KanbanTask[] => {
    const v = o[k];
    if (!Array.isArray(v)) return [];
    return v.filter((t): t is KanbanTask => {
      if (!t || typeof t !== "object") return false;
      const x = t as Record<string, unknown>;
      return typeof x.id === "string" && typeof x.titre === "string";
    }) as KanbanTask[];
  };
  return {
    todo: col("todo"),
    inprogress: col("inprogress"),
    done: col("done"),
  };
}

export function parseMembreIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
}

export function parseProjetFiles(raw: unknown): TaskFile[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is TaskFile => {
    if (!f || typeof f !== "object") return false;
    const x = f as Record<string, unknown>;
    return typeof x.id === "string" && typeof x.nom === "string" && typeof x.url === "string";
  }) as TaskFile[];
}

export function computeProgress(k: KanbanState): number {
  const total = k.todo.length + k.inprogress.length + k.done.length;
  if (total === 0) return 0;
  return Math.round((k.done.length / total) * 100);
}
