"use client";

import { useChannel, useInbox } from "@portalsdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import LeaveRoom from "./LeaveRoom";
import PresenceBar from "./PresenceBar";
import SessionDoc from "./SessionDoc";
import {
  AGENT_SKIPPED_ACTIVITY,
  AGENT_THINKING_ACTIVITY,
  CONTRADICTION_NOTICE_TYPE,
  GRAPH_DELTA_TYPE,
  GRAPH_PROPOSAL_TYPE,
  agentActivity,
  channelIdFor,
  graphWithSnapshot,
  isChatContent,
  isDeltaContent,
  type ChannelContent,
} from "@/lib/channel";
import {
  cursorsFromActivity,
  encodeCursorActivity,
  mergeRemoteCursors,
  shouldEmitCursor,
} from "@/lib/cursor";
import { detailedParticipants, resolveDisplayName } from "@/lib/display";
import { CHAT_WIDTH, ROSTER_WIDTH, clampWidth, widthFromDragX } from "@/lib/panels";

/**
 * Cada cuánto se anuncia la posición del cursor por el carril de actividad, que es el
 * único que entrega de verdad (los otros dos están medidos y muertos; el porqué está en
 * `lib/cursor.ts`).
 *
 * 125 ms son las 8 muestras por segundo que se midieron llegando enteras —40 enviadas,
 * 40 recibidas, hueco medio 138 ms— y que la interpolación de `CursorLayer` convierte en
 * movimiento continuo. Subir el ritmo no haría el cursor más suave: lo limita el viaje,
 * no el muestreo.
 */
const CURSOR_ACTIVITY_INTERVAL = 125;

/**
 * Cada cuánto se deja la posición en la metadata de presencia.
 *
 * Lento a propósito: la metadata no se re-anuncia a mitad de sesión, así que esto no
 * mueve ningún cursor. Solo sirve para que quien entre tarde vea dónde está cada uno sin
 * esperar a que muevan el ratón, porque la metadata sí viaja en la trama de conexión.
 */
const CURSOR_METADATA_INTERVAL = 2_000;

const CHAT_WIDTH_KEY = "synapse:chatWidth";
const ROSTER_COLLAPSED_KEY = "synapse:rosterCollapsed";

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
  onLeave,
}: {
  roomId: string;
  displayName: string;
  onLeave: () => void;
}) {
  const {
    messages,
    send,
    presence,
    me,
    status,
    setMetadata,
    ext,
    typing,
    sendTyping,
    sendActivity,
    activity,
  } = useChannel<ChannelContent>(
    // El backfill por defecto son 50 mensajes; el guion de evaluación son ~40 turnos
    // más el chat de los tres, así que un late-joiner se perdería el arranque.
    {
      channelId: channelIdFor(roomId),
      metadata: { displayName },
      history: 200,
      onMessage: (msg) => {
        if (msg.type === GRAPH_DELTA_TYPE && isDeltaContent(msg.content)) {
          const delta = msg.content;
          console.log(
            `[synapse] delta v${delta.version}: +${delta.addedNodes.length} nodos, +${delta.addedEdges.length} aristas`,
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

  const [knownNames, setKnownNames] = useState<Map<string, string>>(() => new Map());

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
        next.set(participant.id, resolveDisplayName(participant, me, participants));
      }
      return next ?? previous;
    });
  }, [participants, me]);

  const lastActivityRef = useRef<number | undefined>(undefined);
  const lastMetadataRef = useRef<number | undefined>(undefined);

  // El aviso de contradicción llega como item de inbox dirigido (ticket 11); al
  // recibirlo, el canvas centra el nodo en cuestión.
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  useInbox<{ claimId?: string }>({
    onItem: (item) => {
      if (item.type === CONTRADICTION_NOTICE_TYPE && typeof item.data.claimId === "string") {
        setFocusNodeId(item.data.claimId);
      }
    },
  });

  const handleCursorMove = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      if (shouldEmitCursor(lastActivityRef.current, now, CURSOR_ACTIVITY_INTERVAL)) {
        lastActivityRef.current = now;
        sendActivity(encodeCursorActivity(x, y));
      }
      if (shouldEmitCursor(lastMetadataRef.current, now, CURSOR_METADATA_INTERVAL)) {
        lastMetadataRef.current = now;
        setMetadata({ displayName, cursor: { x, y } });
      }
    },
    [sendActivity, setMetadata, displayName],
  );

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

  // El disparo manual de una propuesta desde la consola: `await __synapse.propose()`.
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

  // El estado del agente viaja por el carril de actividad, que expira solo a los 5 s:
  // el banner no puede quedarse congelado leyéndose como un cuelgue.
  const agentKind = agentActivity(activity, me?.id);
  const agentBanner =
    agentKind === AGENT_THINKING_ACTIVITY
      ? { kind: "thinking" as const }
      : agentKind === AGENT_SKIPPED_ACTIVITY
        ? { kind: "skipped" as const }
        : null;

  // ── Los paneles ───────────────────────────────────────────────────────────────────
  const [chatWidth, setChatWidth] = useState<number>(CHAT_WIDTH.initial);
  const [rosterCollapsed, setRosterCollapsed] = useState(false);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CHAT_WIDTH_KEY);
      setChatWidth(clampWidth(stored === null ? undefined : Number(stored), CHAT_WIDTH, CHAT_WIDTH.initial));
      setRosterCollapsed(window.localStorage.getItem(ROSTER_COLLAPSED_KEY) === "1");
    } catch {
      // Sin storage (incógnito, iframe, túnel): los paneles arrancan por defecto.
    }
  }, []);

  // El arrastre se escucha en `window` y no en el tirador: si el puntero adelanta al
  // render y se sale del elemento, el redimensionado no debe quedarse pegado a medias.
  useEffect(() => {
    if (!resizing) {
      return;
    }
    function onMove(event: PointerEvent) {
      setChatWidth(widthFromDragX(event.clientX, window.innerWidth));
    }
    function onUp() {
      setResizing(false);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [resizing]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_WIDTH_KEY, String(chatWidth));
      window.localStorage.setItem(ROSTER_COLLAPSED_KEY, rosterCollapsed ? "1" : "0");
    } catch {
      // Sin storage: la preferencia dura lo que dure la pestaña.
    }
  }, [chatWidth, rosterCollapsed]);

  return (
    <main
      className="flex h-screen overflow-hidden"
      // Mientras se arrastra, todo el documento muestra el cursor de redimensionado y
      // nada selecciona texto: si no, arrastrar sobre el chat marca los mensajes.
      style={resizing ? { cursor: "col-resize", userSelect: "none" } : undefined}
    >
      <PresenceBar
        me={me}
        participants={participants}
        status={status}
        graphVersion={graph.version}
        width={ROSTER_WIDTH.initial}
        collapsed={rosterCollapsed}
        onToggle={() => setRosterCollapsed((value) => !value)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border glass px-4 py-2.5">
          <span className="text-sm font-semibold tracking-tight">
            <span className="text-primary">Synapse</span>
            <span className="mx-2 text-border">/</span>
            <span className="text-muted-foreground">{roomId}</span>
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {graph.nodes.length} nodos · {graph.edges.length} relaciones
          </span>
        </header>
        <GraphCanvas
          graph={graph}
          remoteCursors={mergeRemoteCursors(
            me,
            participants,
            cursorsFromActivity(activity, me?.id),
          )}
          onCursorMove={handleCursorMove}
          focusNodeId={focusNodeId}
        />
      </div>

      {/* El tirador del chat. Ancho de 5 px pero con una barra visible de 1 px: lo que
          hay que acertar con el ratón es más grande que lo que se ve. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Ajustar el ancho del chat"
        onPointerDown={(event) => {
          event.preventDefault();
          setResizing(true);
        }}
        onDoubleClick={() => setChatWidth(CHAT_WIDTH.initial)}
        className="group relative w-1.5 shrink-0 cursor-col-resize bg-border/50 transition-colors hover:bg-primary/60"
      >
        <span className="absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/40 transition-colors group-hover:bg-primary" />
      </div>

      <div style={{ width: chatWidth }} className="shrink-0">
        <ChatPanel
          messages={chatMessages}
          me={me}
          participants={participants}
          knownNames={knownNames}
          onSend={(text) => send({ content: { text } })}
          typing={typing}
          onTyping={sendTyping}
          agentBanner={agentBanner}
          header={
            <>
              <SessionDoc markdown={renderDocument(graph)} />
              <LeaveRoom displayName={displayName} onLeave={onLeave} />
            </>
          }
        />
      </div>
    </main>
  );
}
