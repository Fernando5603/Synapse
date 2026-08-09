"use client";

import type { ChannelStatus } from "@portalsdk/core";
import { PanelLeftClose, PanelLeftOpen, Users } from "lucide-react";
import { buildRoster, type Me, type Participant } from "@/lib/display";
import { participantColor } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export default function PresenceBar({
  me,
  participants,
  status,
  graphVersion,
  width,
  collapsed,
  onToggle,
}: {
  me: Me | undefined;
  participants: Participant[];
  status: ChannelStatus;
  /** Versión del último `graph.delta` aplicado: dice si esta pantalla está al día. */
  graphVersion: number;
  width: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  // Colapsado el panel es una tira de avatares: sigue diciendo quién está sin gastar
  // ancho, que es justo lo que se le pedía.
  if (collapsed) {
    return (
      <aside className="flex w-14 shrink-0 flex-col items-center gap-3 border-r border-border glass py-3">
        <Button variant="ghost" size="icon" onClick={onToggle} title="Mostrar el panel">
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
        <div className="h-px w-6 bg-border" />
        {buildRoster(me, participants).map((row) => (
          <div
            key={row.id}
            title={row.displayName}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-background"
            style={{
              background: participantColor(row.id),
              boxShadow: `0 0 12px ${participantColor(row.id)}55`,
            }}
          >
            {initials(row.displayName)}
          </div>
        ))}
      </aside>
    );
  }

  const roster = me === undefined ? [] : buildRoster(me, participants);

  return (
    <aside
      className="flex shrink-0 flex-col gap-4 border-r border-border glass p-4"
      style={{ width }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            En la sala
          </h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onToggle} title="Ocultar el panel">
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {me === undefined ? (
        <p className="text-sm text-muted-foreground">Conectando…</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {roster.map((row) => (
            <li
              key={row.id}
              className="flex animate-fade-in items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/60"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-background"
                style={{
                  background: participantColor(row.id),
                  boxShadow: `0 0 10px ${participantColor(row.id)}55`,
                }}
              >
                {initials(row.displayName)}
              </span>
              <span className="truncate text-sm" title={row.displayName}>
                {row.displayName}
              </span>
              {row.isMe && (
                <span className="ml-auto text-[10px] text-muted-foreground">tú</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              status === "ready"
                ? "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400"
                : status === "blocked"
                  ? "bg-destructive"
                  : "animate-pulse bg-amber-400",
            )}
          />
          <span className="text-muted-foreground">{statusLabel(status)}</span>
        </div>
        <Badge variant="primary" className="w-fit font-mono" title="Versión del último delta recibido">
          grafo v{graphVersion}
        </Badge>
      </div>
    </aside>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function statusLabel(status: ChannelStatus): string {
  switch (status) {
    case "ready":
      return "Conectado";
    case "connecting":
      return "Conectando…";
    case "reconnecting":
      return "Reconectando…";
    case "degraded":
      return "Modo degradado";
    case "degraded-http":
      return "Canal degradado";
    case "blocked":
      return "Bloqueado";
    default:
      return status;
  }
}
