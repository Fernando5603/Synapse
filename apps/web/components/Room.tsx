"use client";

import { useChannel } from "@portalsdk/react";
import { useEffect, useRef, useState } from "react";
import type { Message } from "@portalsdk/core";
import { renderDocument } from "@synapse/graph-core";
import ChatPanel from "./ChatPanel";
import GraphCanvas from "./GraphCanvas";
import PresenceBar from "./PresenceBar";
import SessionDoc from "./SessionDoc";
import { isChatContent, isCursorContent, type ChannelContent } from "@/lib/channel";
import {
  mergeRemoteCursors,
  shouldEmitCursor,
  type CursorPosition,
} from "@/lib/cursor";
import { detailedParticipants, resolveDisplayName } from "@/lib/display";
import { mockSessionGraph } from "@/lib/mockGraph";

const CURSOR_EPHEMERAL_INTERVAL = 50;
const CURSOR_METADATA_INTERVAL = 250;

export default function Room({
  roomId,
  displayName,
}: {
  roomId: string;
  displayName: string;
}) {
  const { messages, send, presence, me, status, setMetadata } = useChannel<ChannelContent>(
    // El backfill por defecto son 50 mensajes; el guion de evaluación son ~40 turnos
    // más el chat de los tres, así que un late-joiner se perdería el arranque.
    {
      channelId: roomId,
      metadata: { displayName },
      history: 200,
      onMessage: (msg) => {
        if (msg.ephemeral && msg.type === "cursor" && isCursorContent(msg.content)) {
          const { x, y } = msg.content;
          setLiveCursors((previous) => {
            const next = new Map(previous);
            next.set(msg.sender.id, { x, y });
            return next;
          });
        }
      },
    },
  );

  const chatMessages = messages.filter((m): m is Message<{ text: string }> =>
    isChatContent(m.content),
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

  const [liveCursors, setLiveCursors] = useState<Map<string, CursorPosition>>(
    () => new Map(),
  );
  const lastEphemeralRef = useRef<number | undefined>(undefined);
  const lastMetadataRef = useRef<number | undefined>(undefined);

  function handleCursorMove(x: number, y: number) {
    const now = Date.now();
    if (shouldEmitCursor(lastEphemeralRef.current, now, CURSOR_EPHEMERAL_INTERVAL)) {
      lastEphemeralRef.current = now;
      send({ ephemeral: true, type: "cursor", content: { x, y } });
    }
    if (shouldEmitCursor(lastMetadataRef.current, now, CURSOR_METADATA_INTERVAL)) {
      lastMetadataRef.current = now;
      setMetadata({ displayName, cursor: { x, y } });
    }
  }

  // Datos estáticos con el tamaño de una sesión real mientras 04/06 no existen;
  // cuando aterricen, esta fuente se sustituye por el grafo autoritativo.
  const [graph] = useState(() => mockSessionGraph());

  return (
    <main style={{ display: "flex", height: "100vh" }}>
      <PresenceBar me={me} participants={participants} status={status} />
      <GraphCanvas
        graph={graph}
        remoteCursors={mergeRemoteCursors(me, participants, liveCursors)}
        onCursorMove={handleCursorMove}
      />
      <ChatPanel
        messages={chatMessages}
        me={me}
        participants={participants}
        knownNames={knownNames}
        onSend={(text) => send({ content: { text } })}
        action={
          <SessionDoc markdown={renderDocument(graph)} />
        }
      />
    </main>
  );
}
