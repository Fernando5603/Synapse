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
  channelIdFor,
  graphWithSnapshot,
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

// Desde el ticket 06 la extensión mergea esto de verdad: los nodos que aparecen son los
// que acuña `mergeProposal`, y proponerlo dos veces no duplica nada.
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
  const { messages, send, presence, me, status, setMetadata, ext } = useChannel<ChannelContent>(
    // El backfill por defecto son 50 mensajes; el guion de evaluación son ~40 turnos
    // más el chat de los tres, así que un late-joiner se perdería el arranque.
    {
      channelId: channelIdFor(roomId),
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
        // Traza de bring-up: separa "el delta no llegó" de "llegó y no se pintó".
        // Se puede quitar cuando el 05 deje el camino andando solo.
        if (msg.type.startsWith("graph.")) {
          console.log("[synapse] recibido:", msg.type, msg.content);
        }
        if (msg.type === GRAPH_DELTA_TYPE && isDeltaContent(msg.content)) {
          const delta = msg.content;
          console.log(
            `[synapse] delta v${delta.version}: ${delta.addedNodes.length} nodos, ${delta.addedEdges.length} aristas`,
          );
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
  // su dueña. Arranca vacío y se llena por dos caminos que convergen: los deltas que van
  // llegando, y el grafo entero que la extensión sirve en la trama de conexión.
  const [graph, setGraph] = useState<Graph>(emptyGraph);

  // El late-join entero. `ext` llega con el `ready` —también el de cada reconexión—, así
  // que esto corre en cuanto hay grafo autoritativo que leer: una pestaña abierta a mitad
  // de sesión lo pinta completo sin esperar a que pase nada en la sala.
  useEffect(() => {
    setGraph((previous) => graphWithSnapshot(previous, ext));
  }, [ext]);

  // Hasta que el backend sea participante del canal (ticket 05), la única forma de
  // entregarle una propuesta a la extensión es a mano. El handle del canal vive dentro
  // del hook, así que la sala lo asoma para poder dispararlo desde la consola:
  //     await __synapse.propose()
  useEffect(() => {
    console.log(`[synapse] canal: ${channelIdFor(roomId)}`);
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
