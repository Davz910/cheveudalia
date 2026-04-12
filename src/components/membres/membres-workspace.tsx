"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  MODULE_PERMISSION_LABELS,
  PERMISSION_MODULE_KEYS,
  ROLE_LABELS,
  defaultPermissionsForRole,
  type ModuleKey,
  type Role,
} from "@/lib/roles";
import { Plus, Copy, Eye, EyeOff, RefreshCw, Share2, Trash2, UserMinus, UserCheck } from "lucide-react";

type MembreRh = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  role: Role;
  statut: string | null;
  horaires: string | null;
  code_acces: string | null;
  expiration_acces: string | null;
  contrat: string | null;
  salaire: number | null;
  gratif: number | null;
  gratif_freq: string | null;
  date_debut: string | null;
  date_fin: string | null;
  permissions: Record<string, unknown> | null;
  presences: unknown;
};

const ROLES: Role[] = ["gerant", "sav", "logistique", "marketing", "cm"];

const CONTRAT_TYPES = ["CDI", "CDD", "Stage", "Prestataire"] as const;

function generateAccessCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function initials(prenom: string, nom: string) {
  const a = prenom?.[0] ?? "";
  const b = nom?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

function parsePermissions(m: MembreRh | null): Record<ModuleKey, boolean> {
  const base = defaultPermissionsForRole((m?.role ?? "cm") as Role);
  const p = m?.permissions;
  if (p && typeof p === "object" && !Array.isArray(p)) {
    for (const key of PERMISSION_MODULE_KEYS) {
      const v = (p as Record<string, unknown>)[key];
      if (typeof v === "boolean") base[key] = v;
    }
  }
  return base;
}

function parsePresences(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

/** Lundi = 0 … dimanche = 6 */
function mondayWeekdayIndex(d: Date) {
  return (getDay(d) + 6) % 7;
}

export function MembresWorkspace({ currentGerantId }: { currentGerantId: string }) {
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<MembreRh[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MembreRh | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [codeVisible, setCodeVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("membres").select("*").order("nom");
    if (error) {
      toast({ title: "Membres", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const list = (data ?? []) as MembreRh[];
    setRows(list);
    setSelected((prev) => {
      if (!prev) return list[0] ?? null;
      const f = list.find((r) => r.id === prev.id);
      return f ?? list[0] ?? null;
    });
    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCodeVisible(false);
  }, [selected?.id]);

  const expirationExpired =
    selected?.expiration_acces != null && new Date(selected.expiration_acces).getTime() < Date.now();

  return (
    <div className="flex h-full min-h-0 gap-0">
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border p-3">
          <Button className="w-full gap-2 bg-primary text-primary-foreground" size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouveau membre
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-2">
            {loading ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">Chargement…</p>
            ) : rows.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">Aucun membre.</p>
            ) : (
              rows.map((m) => {
                const sel = selected?.id === m.id;
                const ok = (m.statut ?? "actif") === "actif";
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelected(m)}
                    className={cn(
                      "mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-muted",
                      sel && "bg-[hsl(336_56%_95%)] ring-1 ring-primary/20"
                    )}
                  >
                    <div className="relative shrink-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-[11px] font-medium text-primary">
                        {initials(m.prenom, m.nom)}
                      </div>
                      <span
                        className={cn(
                          "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card",
                          ok ? "bg-emerald-500" : "bg-muted-foreground/50"
                        )}
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {m.prenom} {m.nom}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">{ROLE_LABELS[m.role]}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-5">
        {!selected ? (
          <p className="text-sm text-muted-foreground">Sélectionnez un membre ou créez-en un.</p>
        ) : (
          <MembreDetail
            key={selected.id}
            membre={selected}
            currentGerantId={currentGerantId}
            codeVisible={codeVisible}
            setCodeVisible={setCodeVisible}
            expirationExpired={expirationExpired}
            onUpdated={(m) => {
              setRows((prev) => prev.map((r) => (r.id === m.id ? m : r)));
              setSelected(m);
            }}
            onAskDelete={() => setDeleteOpen(true)}
            supabase={supabase}
            toast={toast}
          />
        )}
      </div>

      <NewMembreDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        supabase={supabase}
        toast={toast}
        onCreated={(row) => {
          void load();
          setSelected(row);
        }}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce membre ?</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Le compte de {selected?.prenom} {selected?.nom} sera définitivement
              supprimé.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (!selected) return;
                const { error } = await supabase.from("membres").delete().eq("id", selected.id);
                if (error) {
                  toast({ title: "Suppression impossible", description: error.message, variant: "destructive" });
                  return;
                }
                toast({ title: "Membre supprimé" });
                setDeleteOpen(false);
                setSelected(null);
                void load();
              }}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewMembreDialog({
  open,
  onOpenChange,
  supabase,
  toast,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supabase: ReturnType<typeof createClient>;
  toast: ReturnType<typeof useToast>["toast"];
  onCreated: (m: MembreRh) => void;
}) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("cm");
  const [code, setCode] = useState("");
  const [exp, setExp] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPrenom("");
      setNom("");
      setEmail("");
      setRole("cm");
      setCode(generateAccessCode());
      setExp("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau membre</DialogTitle>
          <DialogDescription>Créer un compte : le salarié se connecte avec son email et le code d&apos;accès.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="nm-prenom">Prénom</Label>
            <Input id="nm-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nm-nom">Nom</Label>
            <Input id="nm-nom" value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nm-email">Email</Label>
            <Input id="nm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Rôle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Code d&apos;accès</Label>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono" maxLength={16} />
              <Button type="button" variant="outline" size="sm" onClick={() => setCode(generateAccessCode())}>
                Générer
              </Button>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nm-exp">Date d&apos;expiration du code (optionnel)</Label>
            <Input id="nm-exp" type="date" value={exp} onChange={(e) => setExp(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!prenom.trim() || !nom.trim() || !email.trim() || !code.trim()) {
                toast({ title: "Champs requis", description: "Prénom, nom, email et code sont obligatoires.", variant: "destructive" });
                return;
              }
              setSaving(true);
              const perms = defaultPermissionsForRole(role);
              const row = {
                prenom: prenom.trim(),
                nom: nom.trim(),
                email: email.trim().toLowerCase(),
                role,
                code_acces: code.trim(),
                expiration_acces: exp ? new Date(exp + "T23:59:59").toISOString() : null,
                statut: "actif",
                permissions: perms as unknown as Record<string, unknown>,
              };
              const { data, error } = await supabase.from("membres").insert(row).select("*").single();
              setSaving(false);
              if (error) {
                toast({ title: "Création impossible", description: error.message, variant: "destructive" });
                return;
              }
              toast({ title: "Membre créé" });
              onOpenChange(false);
              onCreated(data as MembreRh);
            }}
          >
            Créer le membre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembreDetail({
  membre,
  currentGerantId,
  codeVisible,
  setCodeVisible,
  expirationExpired,
  onUpdated,
  onAskDelete,
  supabase,
  toast,
}: {
  membre: MembreRh;
  currentGerantId: string;
  codeVisible: boolean;
  setCodeVisible: (v: boolean) => void;
  expirationExpired: boolean;
  onUpdated: (m: MembreRh) => void;
  onAskDelete: () => void;
  supabase: ReturnType<typeof createClient>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [profil, setProfil] = useState({
    prenom: membre.prenom,
    nom: membre.nom,
    email: membre.email,
    role: membre.role,
    horaires: membre.horaires ?? "",
    statut: (membre.statut ?? "actif") as "actif" | "inactif",
  });
  const [perms, setPerms] = useState(() => parsePermissions(membre));
  const [rh, setRh] = useState({
    contrat: membre.contrat ?? "",
    salaire: membre.salaire != null ? String(membre.salaire) : "",
    gratif: membre.gratif != null ? String(membre.gratif) : "",
    gratif_freq: membre.gratif_freq ?? "",
    date_debut: membre.date_debut ? membre.date_debut.slice(0, 10) : "",
    date_fin: membre.date_fin ? membre.date_fin.slice(0, 10) : "",
  });
  const [presMonth, setPresMonth] = useState(() => startOfMonth(new Date()));
  const [presMap, setPresMap] = useState(() => parsePresences(membre.presences));

  useEffect(() => {
    setProfil({
      prenom: membre.prenom,
      nom: membre.nom,
      email: membre.email,
      role: membre.role,
      horaires: membre.horaires ?? "",
      statut: (membre.statut ?? "actif") === "actif" ? "actif" : "inactif",
    });
    setPerms(parsePermissions(membre));
    setRh({
      contrat: membre.contrat ?? "",
      salaire: membre.salaire != null ? String(membre.salaire) : "",
      gratif: membre.gratif != null ? String(membre.gratif) : "",
      gratif_freq: membre.gratif_freq ?? "",
      date_debut: membre.date_debut ? membre.date_debut.slice(0, 10) : "",
      date_fin: membre.date_fin ? membre.date_fin.slice(0, 10) : "",
    });
    setPresMap(parsePresences(membre.presences));
  }, [membre]);

  const isSelf = membre.id === currentGerantId;

  const saveProfil = async () => {
    const { data, error } = await supabase
      .from("membres")
      .update({
        prenom: profil.prenom.trim(),
        nom: profil.nom.trim(),
        email: profil.email.trim().toLowerCase(),
        role: profil.role,
        horaires: profil.horaires.trim() || null,
        statut: profil.statut,
      })
      .eq("id", membre.id)
      .select("*")
      .single();
    if (error) {
      toast({ title: "Enregistrement impossible", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Profil enregistré" });
    onUpdated(data as MembreRh);
  };

  const saveAcces = async () => {
    const { data, error } = await supabase
      .from("membres")
      .update({ permissions: perms as unknown as Record<string, unknown> })
      .eq("id", membre.id)
      .select("*")
      .single();
    if (error) {
      toast({ title: "Permissions", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Accès enregistrés" });
    onUpdated(data as MembreRh);
  };

  const saveRh = async () => {
    const { data, error } = await supabase
      .from("membres")
      .update({
        contrat: rh.contrat.trim() || null,
        salaire: rh.salaire ? Number(rh.salaire) : null,
        gratif: rh.gratif ? Number(rh.gratif) : null,
        gratif_freq: rh.gratif_freq.trim() || null,
        date_debut: rh.date_debut || null,
        date_fin: rh.date_fin || null,
      })
      .eq("id", membre.id)
      .select("*")
      .single();
    if (error) {
      toast({ title: "RH", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Contrat enregistré" });
    onUpdated(data as MembreRh);
  };

  const savePresences = async () => {
    const { data, error } = await supabase
      .from("membres")
      .update({ presences: presMap as unknown as Record<string, unknown> })
      .eq("id", membre.id)
      .select("*")
      .single();
    if (error) {
      toast({ title: "Présences", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Présences enregistrées" });
    onUpdated(data as MembreRh);
  };

  const regenCode = async () => {
    const next = generateAccessCode();
    const { data, error } = await supabase
      .from("membres")
      .update({ code_acces: next })
      .eq("id", membre.id)
      .select("*")
      .single();
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Nouveau code généré" });
    onUpdated(data as MembreRh);
    setCodeVisible(true);
  };

  const copyCode = () => {
    const c = membre.code_acces ?? "";
    if (!c) return;
    void navigator.clipboard.writeText(c);
    toast({ title: "Code copié" });
  };

  const shareAccess = () => {
    const msg = `Bonjour ${membre.prenom}, voici tes accès au dashboard Cheveudalia : URL: cheveudalia.vercel.app — Email: ${membre.email} — Code: ${membre.code_acces ?? ""}`;
    void navigator.clipboard.writeText(msg);
    toast({ title: "Message copié", description: "Collez-le dans votre messagerie." });
  };

  const toggleStatut = async () => {
    const next = profil.statut === "actif" ? "inactif" : "actif";
    const { data, error } = await supabase
      .from("membres")
      .update({ statut: next })
      .eq("id", membre.id)
      .select("*")
      .single();
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    setProfil((p) => ({ ...p, statut: next }));
    toast({ title: next === "actif" ? "Membre réactivé" : "Membre désactivé" });
    onUpdated(data as MembreRh);
  };

  const monthStart = startOfMonth(presMonth);
  const monthEnd = endOfMonth(presMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const padBefore = mondayWeekdayIndex(monthStart);
  const days = [...Array(padBefore).fill(null), ...daysInMonth] as (Date | null)[];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {membre.prenom} {membre.nom}
          </h2>
          <p className="text-sm text-muted-foreground">{membre.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={toggleStatut} disabled={isSelf}>
            {profil.statut === "actif" ? (
              <>
                <UserMinus className="mr-1.5 h-4 w-4" />
                Désactiver
              </>
            ) : (
              <>
                <UserCheck className="mr-1.5 h-4 w-4" />
                Réactiver
              </>
            )}
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={onAskDelete} disabled={isSelf}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </div>
      {isSelf ? (
        <p className="text-xs text-muted-foreground">Vous ne pouvez pas désactiver ou supprimer votre propre compte gérant ici.</p>
      ) : null}

      <Tabs defaultValue="profil" className="w-full">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="acces">Accès & Connexion</TabsTrigger>
          <TabsTrigger value="rh">Contrat & RH</TabsTrigger>
          <TabsTrigger value="pres">Présences</TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
              <CardDescription>Identité et rôle</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Prénom</Label>
                <Input value={profil.prenom} onChange={(e) => setProfil((p) => ({ ...p, prenom: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Nom</Label>
                <Input value={profil.nom} onChange={(e) => setProfil((p) => ({ ...p, nom: e.target.value }))} />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={profil.email}
                  onChange={(e) => setProfil((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Rôle</Label>
                <Select
                  value={profil.role}
                  onValueChange={(v) => setProfil((p) => ({ ...p, role: v as Role }))}
                  disabled={isSelf}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Statut</Label>
                <Select
                  value={profil.statut}
                  onValueChange={(v) => setProfil((p) => ({ ...p, statut: v as "actif" | "inactif" }))}
                  disabled={isSelf}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actif">Actif</SelectItem>
                    <SelectItem value="inactif">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Horaires</Label>
                <Textarea
                  rows={3}
                  value={profil.horaires}
                  onChange={(e) => setProfil((p) => ({ ...p, horaires: e.target.value }))}
                  placeholder="Ex. Lun–Ven 9h–18h"
                />
              </div>
            </CardContent>
          </Card>
          <Button onClick={() => void saveProfil()}>Sauvegarder</Button>
        </TabsContent>

        <TabsContent value="acces" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Code d&apos;accès</CardTitle>
              <CardDescription>Connexion avec email + code sur la page de login.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                  {codeVisible ? membre.code_acces ?? "—" : "••••••••"}
                </code>
                <Button type="button" variant="outline" size="sm" onClick={() => setCodeVisible(!codeVisible)}>
                  {codeVisible ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
                  {codeVisible ? "Masquer" : "Révéler"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={copyCode}>
                  <Copy className="mr-1 h-4 w-4" />
                  Copier
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void regenCode()}>
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Regénérer
                </Button>
              </div>
              {membre.expiration_acces ? (
                <p className={cn("text-sm", expirationExpired && "font-medium text-red-600")}>
                  Expiration du code : {format(new Date(membre.expiration_acces), "d MMMM yyyy à HH:mm", { locale: fr })}
                  {expirationExpired ? " — expiré" : ""}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune date d&apos;expiration définie.</p>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="exp-code">Modifier l&apos;expiration du code</Label>
                  <Input
                    id="exp-code"
                    type="date"
                    defaultValue={membre.expiration_acces ? membre.expiration_acces.slice(0, 10) : ""}
                    key={membre.expiration_acces ?? "noexp"}
                    onBlur={async (e) => {
                      const v = e.target.value;
                      const iso = v ? new Date(`${v}T23:59:59`).toISOString() : null;
                      const { data, error } = await supabase
                        .from("membres")
                        .update({ expiration_acces: iso })
                        .eq("id", membre.id)
                        .select("*")
                        .single();
                      if (error) {
                        toast({ title: "Expiration", description: error.message, variant: "destructive" });
                        return;
                      }
                      toast({ title: "Date d'expiration mise à jour" });
                      onUpdated(data as MembreRh);
                    }}
                  />
                </div>
                <p className="pb-2 text-[11px] text-muted-foreground">Validez en cliquant hors du champ.</p>
              </div>
              <Separator />
              <Button type="button" variant="secondary" size="sm" onClick={shareAccess}>
                <Share2 className="mr-2 h-4 w-4" />
                Envoyer les accès
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Permissions par module</CardTitle>
              <CardDescription>Définissez les écrans accessibles pour ce membre.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {PERMISSION_MODULE_KEYS.map((key) => (
                <div key={key} className="flex items-center justify-between gap-4 rounded-md border border-border/60 px-3 py-2">
                  <Label htmlFor={`perm-${key}`} className="cursor-pointer text-sm font-normal">
                    {MODULE_PERMISSION_LABELS[key]}
                  </Label>
                  <Switch
                    id={`perm-${key}`}
                    checked={perms[key] ?? false}
                    onCheckedChange={(c) => setPerms((p) => ({ ...p, [key]: c }))}
                    disabled={membre.role === "gerant"}
                  />
                </div>
              ))}
              {membre.role === "gerant" ? (
                <p className="text-xs text-muted-foreground">Le compte gérant a accès à tous les modules.</p>
              ) : null}
            </CardContent>
          </Card>
          <Button onClick={() => void saveAcces()} disabled={membre.role === "gerant"}>
            Sauvegarder
          </Button>
        </TabsContent>

        <TabsContent value="rh" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contrat & rémunération</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Type de contrat</Label>
                <Select value={rh.contrat || "none"} onValueChange={(v) => setRh((r) => ({ ...r, contrat: v === "none" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {CONTRAT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Salaire brut (€)</Label>
                <Input value={rh.salaire} onChange={(e) => setRh((r) => ({ ...r, salaire: e.target.value }))} inputMode="decimal" />
              </div>
              <div className="grid gap-1.5">
                <Label>Gratification stage (€)</Label>
                <Input value={rh.gratif} onChange={(e) => setRh((r) => ({ ...r, gratif: e.target.value }))} inputMode="decimal" />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Fréquence / détail gratification</Label>
                <Input value={rh.gratif_freq} onChange={(e) => setRh((r) => ({ ...r, gratif_freq: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Date de début</Label>
                <Input type="date" value={rh.date_debut} onChange={(e) => setRh((r) => ({ ...r, date_debut: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Date de fin</Label>
                <Input type="date" value={rh.date_fin} onChange={(e) => setRh((r) => ({ ...r, date_fin: e.target.value }))} />
              </div>
            </CardContent>
          </Card>
          <Button onClick={() => void saveRh()}>Sauvegarder</Button>
        </TabsContent>

        <TabsContent value="pres" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Présences</CardTitle>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setPresMonth((m) => subMonths(m, 1))}>
                  ←
                </Button>
                <span className="min-w-[140px] text-center text-sm font-medium capitalize">
                  {format(presMonth, "MMMM yyyy", { locale: fr })}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => setPresMonth((m) => addMonths(m, 1))}>
                  →
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
                {["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((d, idx) => {
                  if (!d) return <div key={`pad-${idx}`} className="aspect-square" />;
                  const key = format(d, "yyyy-MM-dd");
                  const st = presMap[key];
                  const present = st === true;
                  const absent = st === false;
                  return (
                    <button
                      key={key}
                      type="button"
                      title={key}
                      onClick={() =>
                        setPresMap((prev) => {
          const cur = prev[key];
          const next = { ...prev };
          if (cur === undefined) next[key] = true;
          else if (cur === true) next[key] = false;
          else delete next[key];
          return next;
                        })
                      }
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-md border text-[11px] transition-colors",
                        present && "border-emerald-500/50 bg-emerald-500/15 text-emerald-900",
                        absent && "border-red-500/50 bg-red-500/10 text-red-900",
                        !present && !absent && "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {format(d, "d")}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Clic : absent → présent (vert) → absent (rouge) → effacé.
              </p>
            </CardContent>
          </Card>
          <Button onClick={() => void savePresences()}>Sauvegarder</Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
