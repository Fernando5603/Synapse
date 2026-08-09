"use client";

import type { ChannelStatus } from "@portalsdk/core";
import { buildRoster, type Me, type Participant } from "@/lib/display";

export default function PresenceBar({
  me,
  participants,
  status,
  graphVersion,
}: {
  me: Me | undefined;
  participants: Participant[];
  status: ChannelStatus;
  /** Versión del último `graph.delta` aplicado: dice si esta pantalla está al día. */
  graphVersion: number;
}) {
  if (me === undefined) {
    return (
      <aside
        style={{ width: 220, borderRight: "1px solid #ddd", padding: 16 }}
      >
        <p>Conectando…</p>
      </aside>
    );
  }

  const roster = buildRoster(me, participants);

  return (
    <aside style={{ width: 220, borderRight: "1px solid #ddd", padding: 16 }}>
      <h2 style={{ fontSize: 14, textTransform: "uppercase" }}>En la sala</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {roster.map((row) => (
          <li key={row.id} style={{ marginBottom: 6 }}>
            {row.displayName}
            {row.isMe ? " (tú)" : ""}
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 12, color: "#666", marginTop: 16 }}>
        {statusLabel(status)}
      </p>
      <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
        Grafo{" "}
        <span
          title="Versión del último delta recibido"
          style={{
            background: "#eef1f8",
            borderRadius: 4,
            padding: "1px 6px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          v{graphVersion}
        </span>
      </p>
    </aside>
  );
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
