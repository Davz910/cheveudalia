import type { KanbanColumnId, KanbanState, KanbanTask } from "@/types/projets";
import { KANBAN_COLUMNS } from "@/types/projets";

export function findTaskColumn(kanban: KanbanState, taskId: string): KanbanColumnId | null {
  for (const col of KANBAN_COLUMNS) {
    if (kanban[col].some((t) => t.id === taskId)) return col;
  }
  return null;
}

export function findTask(kanban: KanbanState, taskId: string): KanbanTask | null {
  for (const col of KANBAN_COLUMNS) {
    const t = kanban[col].find((x) => x.id === taskId);
    if (t) return { ...t };
  }
  return null;
}

export function removeTaskFromKanban(kanban: KanbanState, taskId: string): { next: KanbanState; task: KanbanTask | null } {
  const next: KanbanState = {
    todo: [...kanban.todo],
    inprogress: [...kanban.inprogress],
    done: [...kanban.done],
  };
  let removed: KanbanTask | null = null;
  for (const col of KANBAN_COLUMNS) {
    const i = next[col].findIndex((t) => t.id === taskId);
    if (i >= 0) {
      removed = next[col][i];
      next[col] = next[col].filter((t) => t.id !== taskId);
      break;
    }
  }
  return { next, task: removed };
}

export function insertTaskInColumn(
  kanban: KanbanState,
  col: KanbanColumnId,
  task: KanbanTask,
  index?: number
): KanbanState {
  const next: KanbanState = {
    todo: [...kanban.todo],
    inprogress: [...kanban.inprogress],
    done: [...kanban.done],
  };
  const list = [...next[col]];
  const i = index === undefined ? list.length : Math.max(0, Math.min(index, list.length));
  list.splice(i, 0, task);
  next[col] = list;
  return next;
}

/** Résout la colonne cible depuis overId (id colonne ou id tâche). */
export function resolveDropColumn(kanban: KanbanState, overId: string): KanbanColumnId | null {
  if (KANBAN_COLUMNS.includes(overId as KanbanColumnId)) return overId as KanbanColumnId;
  const col = findTaskColumn(kanban, overId);
  return col;
}

export function indexInColumn(kanban: KanbanState, col: KanbanColumnId, taskId: string): number {
  return kanban[col].findIndex((t) => t.id === taskId);
}
