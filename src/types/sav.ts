export type SavMsgDirection = "in" | "out" | "internal";

export type SavMsg = {
  d: SavMsgDirection;
  t: string;
  h: string;
  agent?: string;
};

export type TicketSavRow = {
  id: string;
  client_nom: string | null;
  client_email: string | null;
  client_tel: string | null;
  marche: string | null;
  canal: string | null;
  sujet: string | null;
  statut: string | null;
  priorite: string | null;
  assigned_to: string | null;
  etat: string | null;
  msgs: SavMsg[] | null;
  created_at: string;
  updated_at: string;
};

export function parseMsgs(raw: unknown): SavMsg[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: SavMsg[] = [];
  for (const m of raw) {
    if (typeof m !== "object" || m === null) continue;
    const o = m as Record<string, unknown>;
    if (typeof o.t !== "string" || typeof o.h !== "string") continue;
    if (o.d !== "in" && o.d !== "out" && o.d !== "internal") continue;
    const msg: SavMsg = { d: o.d as SavMsgDirection, t: o.t, h: o.h };
    if (typeof o.agent === "string") msg.agent = o.agent;
    out.push(msg);
  }
  return out;
}
