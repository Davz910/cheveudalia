"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  createTicket: (payload: {
    client_nom: string;
    client_email: string;
    client_tel: string;
    sujet: string;
  }) => Promise<{ error?: string }>;
};

export function SavNewTicketDialog({ open, onOpenChange, onCreated, createTicket }: Props) {
  const [clientNom, setClientNom] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientTel, setClientTel] = useState("");
  const [sujet, setSujet] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!clientEmail.trim()) {
      setErr("L’email client est obligatoire.");
      return;
    }
    setPending(true);
    const r = await createTicket({
      client_nom: clientNom.trim(),
      client_email: clientEmail.trim().toLowerCase(),
      client_tel: clientTel.trim(),
      sujet: sujet.trim() || "Sans objet",
    });
    setPending(false);
    if (r.error) {
      setErr(r.error);
      return;
    }
    setClientNom("");
    setClientEmail("");
    setClientTel("");
    setSujet("");
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Nouveau ticket email</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="nt-nom">Nom client</Label>
            <Input id="nt-nom" value={clientNom} onChange={(e) => setClientNom(e.target.value)} placeholder="Nom" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nt-email">Email client</Label>
            <Input
              id="nt-email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@…"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nt-tel">Téléphone (optionnel)</Label>
            <Input id="nt-tel" value={clientTel} onChange={(e) => setClientTel(e.target.value)} placeholder="+33…" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nt-sujet">Sujet</Label>
            <Input id="nt-sujet" value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Objet du mail" />
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Création…" : "Créer le ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
