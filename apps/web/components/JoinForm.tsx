"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

export function JoinForm({
  roomId,
  onJoin,
  onCancel,
}: {
  roomId: string;
  onJoin: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in rounded-lg border border-border glass p-6 shadow-2xl shadow-black/40">
        <Badge variant="primary" className="mb-4">
          sala · {roomId}
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">¿Cómo te llamas?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Así te ven los demás en la sala y en el grafo.
        </p>
        <form
          className="mt-5 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (trimmed !== "") {
              onJoin(trimmed);
            }
          }}
        >
          <Input
            autoFocus
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" disabled={name.trim() === ""}>
            Entrar a la sala
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Elegir otra sala
          </Button>
        </form>
      </div>
    </main>
  );
}
