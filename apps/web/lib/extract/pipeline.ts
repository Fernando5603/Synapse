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
   */
  deliver: (roomId: string, proposal: Proposal) => Promise<void>;
}

export interface Pipeline {
  /** Registra un mensaje del webhook; devuelve la propuesta entregada, o nada. */
  onMessage(event: WebhookEvent, now: number): Promise<unknown>;
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
    try {
      const turns = room.turns;
      if (turns.length === 0) {
        return;
      }

      const window = contextWindow(turns, options.contextSize);
      const prompt = buildPrompt({ turns: window, nodes: options.mirror.get().nodes });

      // Política de fallo (V5): timeout duro vive en el cliente LLM; aquí corre el
      // reintento. Si el lote falla —el LLM o la entrega— se **arrastra**: los turnos
      // no se pierden, y el lote siguiente los vuelve a considerar.
      const proposal = await extractWithRetry(prompt);
      if (proposal === undefined) {
        return; // `room.turns` queda intacto: arrastre.
      }

      try {
        await options.deliver(roomId, proposal);
      } catch {
        return; // `room.turns` queda intacto: arrastre.
      }

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

      const turn: Turn = { id: event.id, text, at: now, senderId };
      const before = room.turns.length;
      room.turns = collectTurn(room.turns, turn);
      if (room.turns.length === before) {
        // Reentrega de un evento ya visto: el turno no se duplica.
        return null;
      }
      schedule(roomId, room);

      return null;
    },
  };
}
