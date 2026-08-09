import type { Proposal } from "@synapse/graph-core";
import { collectTurn, contextWindow, type Turn } from "./buffer";
import { classifyWebhook, type WebhookEvent } from "./filter";
import { buildPrompt } from "./prompt";
import type { ExtractorClient } from "./nvidia";
import type { GraphMirror } from "./mirror";

export interface PipelineOptions {
  extractor: ExtractorClient;
  mirror: GraphMirror;
  /** Debounce tras el último turno: 3 s según el spec. */
  debounceMs: number;
  /** Ventana de contexto: los últimos 8 turnos. */
  contextSize: number;
  /** Reintentos del LLM por lote: 1 según la política de fallo (2 intentos en total). */
  retries: number;
  /**
   * Entrega la propuesta a la extensión por el camino del ticket 05. Debe **lanzar**
   * si la entrega falló, para que el lote se arrastre; `propose` no lanza (devuelve
   * `{delta: undefined}`), así que el llamador la envuelve.
   *
   * `authorId` es el autor del último turno del lote: es a quien hay que atribuir la
   * propuesta para que `detectContradiction` no se notifique a sí mismo.
   */
  deliver: (roomId: string, proposal: Proposal, authorId: string | undefined) => Promise<void>;
  /**
   * El nombre de quien habló, para que el prompt pueda atribuir los turnos.
   *
   * Se inyecta porque la única fuente es la presencia del canal del agente, que es
   * transporte: el pipeline sigue siendo puro. Devolver `undefined` es legítimo —el
   * roster puede no tener todavía a quien acaba de escribir— y el prompt cae a una
   * etiqueta genérica.
   */
  resolveSpeaker?: (senderId: string) => string | undefined;
  /**
   * Señales de estado del agente. Son puras: deciden *qué* avisar; la emisión del
   * efímero por el canal es transporte y la hace el runtime.
   */
  signals?: {
    /** El lote empezó a extraerse: "el agente está pensando". */
    onThinking?: (roomId: string) => void;
    /** El lote se descartó (LLM o entrega fallaron): "el agente se saltó un turno". */
    onSkipped?: (roomId: string) => void;
  };
}

export interface PipelineReport {
  /** Lotes completados (el delta de la extensión volvió). */
  completed: number;
  /** Lotes descartados por la rama de fallo. */
  skipped: number;
  /** Latencias de los lotes completados, para el p95 del criterio (a). */
  latenciesMs: number[];
}

export interface Pipeline {
  /** Registra un mensaje del webhook; devuelve la propuesta entregada, o nada. */
  onMessage(event: WebhookEvent, now: number): Promise<unknown>;
  /** La métrica del criterio (a): completados, descartes y p95. */
  report(): PipelineReport;
}

interface RoomState {
  turns: Turn[];
  timer: ReturnType<typeof setTimeout> | undefined;
  flushing: boolean;
}
function emptyRoom(): RoomState {
  return { turns: [], timer: undefined, flushing: false };
}

export function createPipeline(options: PipelineOptions): Pipeline {
  const rooms = new Map<string, RoomState>();
  const report: PipelineReport = { completed: 0, skipped: 0, latenciesMs: [] };

  function schedule(roomId: string, room: RoomState) {
    if (room.timer !== undefined) {
      clearTimeout(room.timer);
    }
    room.timer = setTimeout(() => {
      room.timer = undefined;
      void flush(roomId, room);
    }, options.debounceMs);
  }

  async function extractWithRetry(prompt: string): Promise<Proposal | undefined> {
    for (let attempt = 0; attempt <= options.retries; attempt += 1) {
      const proposal = await options.extractor.extract(prompt);
      if (proposal !== undefined) {
        return proposal;
      }
    }
    return undefined;
  }

  async function flush(roomId: string, room: RoomState) {
    if (room.flushing) {
      return;
    }
    room.flushing = true;
    const started = Date.now();
    try {
      const turns = room.turns;
      if (turns.length === 0) {
        return;
      }

      const window = contextWindow(turns, options.contextSize);
      const prompt = buildPrompt({ turns: window, nodes: options.mirror.get().nodes });

      // "El agente está pensando": el lote empezó a extraerse.
      options.signals?.onThinking?.(roomId);

      // Política de fallo (V5): timeout duro vive en el cliente LLM; aquí corre el
      // reintento. Si el lote falla —el LLM o la entrega— se **arrastra**: los turnos
      // no se pierden, y el lote siguiente los vuelve a considerar.
      const proposal = await extractWithRetry(prompt);
      if (proposal === undefined) {
        report.skipped += 1;
        options.signals?.onSkipped?.(roomId);
        return; // `room.turns` queda intacto: arrastre.
      }

      try {
        // Estampar el autor del turno en los nodos propuestos: sin esto el grafo no sabe
        // quién afirmó cada Claim y `detectContradiction` no tiene a quién avisar.
        const stamped =
          lastAuthor(turns) !== undefined
            ? stampProposalAuthor(proposal, lastAuthor(turns)!)
            : proposal;
        await options.deliver(roomId, stamped, lastAuthor(turns));
      } catch {
        report.skipped += 1;
        options.signals?.onSkipped?.(roomId);
        return; // `room.turns` queda intacto: arrastre.
      }

      report.completed += 1;
      report.latenciesMs.push(Date.now() - started);

      // Entrega confirmada: los turnos del lote ya fueron al LLM. Los que llegaron a
      // mitad de la extracción (o de la entrega) siguen en `room.turns` y se procesan en
      // el lote siguiente; solo se vacía el buffer si no quedó nada nuevo.
      const processedIds = new Set(turns.map((t) => t.id));
      room.turns = room.turns.filter((t) => !processedIds.has(t.id));
      if (room.turns.length > 0) {
        schedule(roomId, room);
      }
    } finally {
      room.flushing = false;
    }
  }

  return {
    async onMessage(event: WebhookEvent, now: number): Promise<unknown> {
      const decision = classifyWebhook(event);
      if (decision.kind !== "turn") {
        return null;
      }

      const { roomId, senderId, text } = decision;
      let room = rooms.get(roomId);
      if (room === undefined) {
        room = emptyRoom();
        rooms.set(roomId, room);
      }

      const turn: Turn = {
        id: event.id,
        text,
        at: now,
        senderId,
        speaker: options.resolveSpeaker?.(senderId),
      };
      const before = room.turns.length;
      room.turns = collectTurn(room.turns, turn);
      if (room.turns.length === before) {
        // Reentrega de un evento ya visto: el turno no se duplica.
        return null;
      }
      schedule(roomId, room);

      return null;
    },
    report(): PipelineReport {
      return report;
    },
  };
}

/** El p95 de un conjunto de latencias, o `undefined` si no hay ninguna. */
export function percentile95(latencies: readonly number[]): number | undefined {
  if (latencies.length === 0) {
    return undefined;
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index]!;
}

/** El autor del último turno del lote: a quien se atribuye la propuesta. */
function lastAuthor(turns: readonly Turn[]): string | undefined {
  const last = turns[turns.length - 1];
  return last?.senderId;
}

/**
 * Pone `proposedBy` en los nodos de la propuesta que no lo traen. El LLM no sabe quién
 * habló; el autor del turno que originó el lote es quien se lleva la autoría del Claim.
 */
function stampProposalAuthor(proposal: Proposal, authorId: string): Proposal {
  return {
    nodes: proposal.nodes.map((node) =>
      node.proposedBy === undefined ? { ...node, proposedBy: authorId } : node,
    ),
    edges: proposal.edges,
  };
}
