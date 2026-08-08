"use client";

import { useChannel } from "@portalsdk/react";
import { useEffect, useState } from "react";
import ChatPanel from "./ChatPanel";
import PresenceBar from "./PresenceBar";
import { detailedParticipants, resolveDisplayName } from "@/lib/display";

export default function Room({
  roomId,
  displayName,
}: {
  roomId: string;
  displayName: string;
}) {
  const { messages, send, presence, me, status } = useChannel<{ text: string }>(
    // El backfill por defecto son 50 mensajes; el guion de evaluación son ~40 turnos
    // más el chat de los tres, así que un late-joiner se perdería el arranque.
    { channelId: roomId, metadata: { displayName }, history: 200 },
  );

  const participants = detailedParticipants(presence);

  const [knownNames, setKnownNames] = useState<Map<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    if (me === undefined) {
      return;
    }
    setKnownNames((previous) => {
      // Devolver `previous` cuando no hay nombres nuevos es lo que deja a React
      // cortar el ciclo: `participants` es un array nuevo en cada render mientras
      // la presencia no sea detallada, y una Map nueva siempre reagendaría otro.
      let next: Map<string, string> | undefined;
      for (const participant of participants) {
        if (previous.has(participant.id)) {
          continue;
        }
        next ??= new Map(previous);
        next.set(
          participant.id,
          resolveDisplayName(participant, me, participants),
        );
      }
      return next ?? previous;
    });
  }, [participants, me]);

  return (
    <main style={{ display: "flex", height: "100vh" }}>
      <PresenceBar me={me} participants={participants} status={status} />
      <ChatPanel
        messages={messages}
        me={me}
        participants={participants}
        knownNames={knownNames}
        onSend={(text) => send({ content: { text } })}
      />
    </main>
  );
}
