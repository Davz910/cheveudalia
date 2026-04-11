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

/** Première route dashboard après connexion */
export function defaultDashboardPath(role: Role): string {
  switch (role) {
    case "sav":
      return "/dashboard/sav";
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
