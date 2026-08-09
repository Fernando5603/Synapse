"use client";

import { useChannel } from "@portalsdk/react";
import { useEffect, useRef, useState } from "react";
import type { Message } from "@portalsdk/core";
import {
  applyDelta,
  emptyGraph,
  renderDocument,
  type Graph,
  type Proposal,
} from "@synapse/graph-core";
import ChatPanel from "./ChatPanel";
import GraphCanvas from "./GraphCanvas";
import PresenceBar from "./PresenceBar";
import SessionDoc from "./SessionDoc";
import {
  GRAPH_DELTA_TYPE,
  GRAPH_PROPOSAL_TYPE,
  isChatContent,
  isCursorContent,
  isDeltaContent,
  type ChannelContent,
} from "@/lib/channel";
import {
  mergeRemoteCursors,
  shouldEmitCursor,
  type CursorPosition,
} from "@/lib/cursor";
import { detailedParticipants, resolveDisplayName } from "@/lib/display";

const CURSOR_EPHEMERAL_INTERVAL = 50;
const CURSOR_METADATA_INTERVAL = 250;

// La extensión todavía ignora el contenido y devuelve un delta fijo (ticket 04), así que
// esto solo tiene que ser una `Proposal` con la forma del contrato.
const DEMO_PROPOSAL: Proposal = {
  nodes: [
    { type: "Concept", name: "latency" },
    { type: "Claim", name: "latency matters more than perfection" },
  ],
  edges: [
    {
      type: "ELABORATES",
      from: "latency matters more than perfection",
      to: "latency",
    },
  ],
};

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
      // El prefijo no es decorativo: `portal.config.ts` engancha la extensión con el
      // template `room-*`, y un template de Portal exige prefijo fijo. Un slug pelado
      // dejaría la sala sin `graph-owner`.
      channelId: `room-${roomId}`,
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
        if (msg.type === GRAPH_DELTA_TYPE && isDeltaContent(msg.content)) {
          const delta = msg.content;
          setGraph((previous) => applyDelta(previous, delta));
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

  // El grafo se construye aplicando los `graph.delta` que difunde la extensión, que es
  // su dueña. Arranca vacío: quien entra a mitad de sesión no lo reconstruye desde el
  // historial —eso lo resuelve el `onSnapshot` del ticket 06—, se llena con lo que llega.
  const [graph, setGraph] = useState<Graph>(emptyGraph);

  // Hasta que el backend sea participante del canal (ticket 05), la única forma de
  // entregarle una propuesta a la extensión es a mano. El handle del canal vive dentro
  // del hook, así que la sala lo asoma para poder dispararlo desde la consola:
  //     await __synapse.propose()
  useEffect(() => {
    const debugWindow = window as unknown as { __synapse?: unknown };
    debugWindow.__synapse = {
      propose: (proposal: Proposal = DEMO_PROPOSAL) =>
        send({ type: GRAPH_PROPOSAL_TYPE, content: proposal }),
    };
    return () => {
      delete debugWindow.__synapse;
    };
  }, [send]);

  return (
    <main style={{ display: "flex", height: "100vh" }}>
      <PresenceBar
        me={me}
        participants={participants}
        status={status}
        graphVersion={graph.version}
      />
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
