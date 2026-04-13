export type Role = "gerant" | "sav" | "logistique" | "marketing" | "cm";

export const ROLE_LABELS: Record<Role, string> = {
  gerant: "Gérant",
  sav: "SAV",
  logistique: "Logistique",
  marketing: "Marketing",
  cm: "CM",
};

/** Segments de route sous /dashboard (sans préfixe) */
export type ModuleKey =
  | "dashboard"
  | "commandes"
  | "produits"
  | "clients"
  | "sav"
  | "logistique"
  | "marketing"
  | "contenus"
  | "influenceurs"
  | "equipe"
  | "finances"
  | "assistant"
  | "projets"
  | "membres"
  | "configuration";

const ALL_MODULES: ModuleKey[] = [
  "dashboard",
  "commandes",
  "produits",
  "clients",
  "sav",
  "logistique",
  "marketing",
  "contenus",
  "influenceurs",
  "equipe",
  "finances",
  "assistant",
  "projets",
  "membres",
  "configuration",
];

/** Modules autorisés par rôle (aligné sur le prototype HTML) */
const ROLE_MODULES: Record<Role, ModuleKey[] | "all"> = {
  gerant: "all",
  sav: [
    "dashboard",
    "commandes",
    "produits",
    "clients",
    "sav",
    "equipe",
    "assistant",
  ],
  logistique: ["dashboard", "commandes", "produits", "logistique", "equipe", "assistant"],
  marketing: [
    "dashboard",
    "commandes",
    "produits",
    "clients",
    "marketing",
    "contenus",
    "influenceurs",
    "equipe",
    "finances",
    "assistant",
  ],
  cm: [
    "dashboard",
    "commandes",
    "clients",
    "contenus",
    "influenceurs",
    "equipe",
    "assistant",
    "projets",
  ],
};

export function modulesForRole(role: Role): ModuleKey[] {
  const m = ROLE_MODULES[role];
  if (m === "all") return [...ALL_MODULES];
  return m;
}

export function roleAllowsModule(role: Role, module: ModuleKey): boolean {
  const m = ROLE_MODULES[role];
  if (m === "all") return true;
  return m.includes(module);
}

/** Libellés pour les toggles de permissions (module Membres & RH) */
export const MODULE_PERMISSION_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  commandes: "Commandes",
  produits: "Produits & stocks",
  clients: "Clients CRM",
  sav: "SAV",
  logistique: "Logistique",
  marketing: "Marketing",
  contenus: "Contenus & CM",
  influenceurs: "Influenceurs & UGC",
  equipe: "Équipe & chat",
  finances: "Finances P&L",
  assistant: "Assistant IA",
  projets: "Projets",
  membres: "Membres & RH",
  configuration: "Configuration",
};

export const PERMISSION_MODULE_KEYS: ModuleKey[] = [
  "dashboard",
  "commandes",
  "produits",
  "clients",
  "sav",
  "logistique",
  "marketing",
  "contenus",
  "influenceurs",
  "equipe",
  "finances",
  "assistant",
  "projets",
  "membres",
  "configuration",
];

/** Objet permissions par défaut aligné sur le rôle (tous les modules explicites). */
export function defaultPermissionsForRole(role: Role): Record<ModuleKey, boolean> {
  const out = {} as Record<ModuleKey, boolean>;
  for (const key of PERMISSION_MODULE_KEYS) {
    out[key] = roleAllowsModule(role, key);
  }
  return out;
}

/** Accès à un module : JSON permissions prioritaire sur les clés définies, sinon rôle. Le gérant a tout. */
export function moduleAllowed(
  role: Role,
  module: ModuleKey,
  permissions: Record<string, unknown> | null | undefined
): boolean {
  if (role === "gerant") return true;
  if (permissions && typeof permissions === "object" && !Array.isArray(permissions)) {
    const v = permissions[module];
    if (typeof v === "boolean") return v;
  }
  return roleAllowsModule(role, module);
}

/** Première route dashboard après connexion */
export function defaultDashboardPath(role: Role): string {
  switch (role) {
    case "sav":
      return "/dashboard/sav/email";
    case "logistique":
      return "/dashboard/logistique";
    case "marketing":
      return "/dashboard/marketing";
    case "cm":
      return "/dashboard/contenus";
    case "gerant":
    default:
      return "/dashboard";
  }
}

export function moduleFromPath(pathname: string): ModuleKey {
  const seg = pathname.replace(/^\/dashboard\/?/, "").split("/")[0];
  if (!seg || seg === "") return "dashboard";
  const map: Record<string, ModuleKey> = {
    commandes: "commandes",
    produits: "produits",
    clients: "clients",
    sav: "sav",
    logistique: "logistique",
    marketing: "marketing",
    contenus: "contenus",
    influenceurs: "influenceurs",
    equipe: "equipe",
    finances: "finances",
    assistant: "assistant",
    projets: "projets",
    membres: "membres",
    configuration: "configuration",
  };
  return map[seg] ?? "dashboard";
}
