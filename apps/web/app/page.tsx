"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ENTITY_PAINT } from "@/lib/palette";

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-in text-center">
        <div className="mb-6 flex justify-center gap-2">
          {Object.entries(ENTITY_PAINT).map(([type, paint], index) => (
            <span
              key={type}
              className="h-2.5 w-2.5 animate-float rounded-full"
              style={{
                background: paint.fill,
                boxShadow: `0 0 14px ${paint.fill}`,
                animationDelay: `${index * 220}ms`,
              }}
            />
          ))}
        </div>

        <h1 className="bg-gradient-to-r from-primary via-foreground to-accent bg-clip-text text-4xl font-bold tracking-tight text-transparent">
          Synapse
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          Hablad. El grafo de lo que decís se dibuja solo, en vivo, para todos.
        </p>

        <form
          className="mt-7 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const slug = roomId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
            if (slug === "") {
              setError("Escribe un nombre de sala.");
              return;
            }
            router.push(`/room/${slug}`);
          }}
        >
          <Input
            autoFocus
            placeholder="Nombre de la sala (p. ej. inteligencia)"
            value={roomId}
            onChange={(e) => {
              setRoomId(e.target.value);
              setError(null);
            }}
            className="h-11 text-center"
          />
          {error !== null && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <Button type="submit" className="h-11">
            Entrar a la sala
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </main>
  );
}
