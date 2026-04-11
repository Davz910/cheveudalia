"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const ROLES = ["Gérant", "SAV", "Logistique", "Marketing", "CM"] as const;

export default function AssistantPage() {
  const [r, setR] = useState<(typeof ROLES)[number]>("Gérant");
  const [input, setInput] = useState("");
  const [out, setOut] = useState("");

  async function send() {
    setOut("…");
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: r, message: input }),
    });
    const data = (await res.json()) as { text?: string; error?: string };
    setOut(data.text ?? data.error ?? "Erreur");
  }

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="mb-4 flex flex-wrap gap-2">
        {ROLES.map((x) => (
          <Button
            key={x}
            type="button"
            size="sm"
            variant={r === x ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setR(x)}
          >
            {x}
          </Button>
        ))}
      </div>
      <Card className="border-border/80 p-4">
        <div className="mb-2 text-sm text-muted-foreground">Claude (Haiku) via route serveur sécurisée.</div>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={4} className="text-sm" />
        <Button type="button" className="mt-2" size="sm" onClick={send}>
          Envoyer
        </Button>
        <pre className="mt-4 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">{out}</pre>
      </Card>
    </div>
  );
}
