"use client";

import type { ChannelStatus } from "@portalsdk/core";
import { buildRoster, type Me, type Participant } from "@/lib/display";

export default function PresenceBar({
  me,
  participants,
  status,
}: {
  me: Me | undefined;
  participants: Participant[];
  status: ChannelStatus;
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
