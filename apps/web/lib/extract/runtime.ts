import { detectContradiction, type Proposal } from "@synapse/graph-core";
import { agentChannel, propose, watchDeltas } from "@/lib/agent";
import {
  AGENT_SKIPPED_ACTIVITY,
  AGENT_THINKING_ACTIVITY,
  CONTRADICTION_NOTICE_TYPE,
} from "@/lib/channel";
import { createMirror, type GraphMirror } from "./mirror";
import { createPipeline, percentile95, type Pipeline, type PipelineReport } from "./pipeline";
import type { ExtractorClient } from "./nvidia";

export interface ExtractionRuntimeOptions {
  extractor: ExtractorClient;
  debounceMs: number;
  contextSize: number;
  /** Reintentos del LLM por lote: 1 según la política de fallo. */
  retries: number;
}

interface RoomRuntime {
  mirror: GraphMirror;
  pipeline: Pipeline;
}

export interface AggregateReport {
  completed: number;
  skipped: number;
  skippedPercent: number;
  p95Ms: number | undefined;
}

const globalForRuntime = globalThis as unknown as { __synapseExtraction?: ExtractionRuntime };

export class ExtractionRuntime {
  #rooms = new Map<string, RoomRuntime>();
  #options: ExtractionRuntimeOptions;

  constructor(options: ExtractionRuntimeOptions) {
    this.#options = options;
  }

  /**
   * El pipeline de una sala, junto con el espejo del grafo que lo alimenta. La primera
   * vez que se pide, suscribe el espejo a los deltas autoritativos del canal del agente
   * y adopta el snapshot de la conexión.
   */
  forRoom(roomId: string): RoomRuntime {
    const existing = this.#rooms.get(roomId);
    if (existing !== undefined) {
      return existing;
    }

    const mirror = createMirror();
    const pipeline = createPipeline({
      extractor: this.#options.extractor,
      mirror,
      debounceMs: this.#options.debounceMs,
      contextSize: this.#options.contextSize,
      retries: this.#options.retries,
      // `propose` no lanza cuando la entrega falla (devuelve `{delta: undefined}`);
      // el arrastre del lote depende de que esto lance.
      // El nombre de quien habló sale del roster de la sala, que el agente ya está
      // escuchando por ser participante. No hay petición extra: la presencia detallada
      // viene en la trama de conexión y se actualiza sola.
      resolveSpeaker: (senderId: string) => speakerName(roomId, senderId),
      deliver: async (room: string, proposal: Proposal, authorId: string | undefined) => {
        // Contradicción dirigida (ticket 11): antes de entregar, sobre el espejo. Si la
        // propuesta contradice un Claim ajeno, el aviso va a su autor como mensaje
        // dirigido — una regla en `portal.config.ts` lo convierte en item de inbox.
        const hit =
          authorId !== undefined
            ? detectContradiction(mirror.get(), proposal, authorId)
            : null;
        if (hit !== null) {
          agentChannel(room).send({
            type: CONTRADICTION_NOTICE_TYPE,
            content: { claimId: hit.claimId },
            to: hit.targetUserId,
          });
        }

        const outcome = await propose(room, proposal);
        if (outcome.delta === undefined) {
          throw new Error(`El agente no recibió el delta de la propuesta de ${room}.`);
        }
      },
      // Las señales del pipeline se convierten en actividad del agente en el canal:
      // "está pensando", "se saltó un turno". El fallo nunca es silencio.
      //
      // Actividad y no efímero: el SDK descarta los efímeros entrantes (ver `channel.ts`),
      // así que el carril efímero no llegaba a ninguna pantalla. La actividad se entrega y
      // expira sola a los 5 s, que es lo que el banner necesitaba de todos modos.
      signals: {
        onThinking: (room) => {
          agentChannel(room).sendActivity(AGENT_THINKING_ACTIVITY);
        },
        onSkipped: (room) => {
          agentChannel(room).sendActivity(AGENT_SKIPPED_ACTIVITY);
        },
      },
    });

    // El espejo se alimenta de los deltas autoritativos, nunca de las propias propuestas.
    watchDeltas(roomId, (delta) => mirror.applyDelta(delta));

    // El snapshot de la extensión, si la conexión ya lo trajo. En la primera llamada el
    // canal está conectando y `ext` es `undefined`; los deltas siguientes dejan el
    // espejo al día igualmente.
    mirror.adoptSnapshot(agentChannel(roomId).ext);

    const runtime: RoomRuntime = { mirror, pipeline };
    this.#rooms.set(roomId, runtime);
    return runtime;
  }

  /**
   * La métrica del criterio (a) agregada sobre todas las salas: p95 de los lotes que
   * completaron y porcentaje que salió por la rama de descarte.
   */
  report(): AggregateReport {
    const reports: PipelineReport[] = [];
    for (const room of this.#rooms.values()) {
      reports.push(room.pipeline.report());
    }

    const completed = reports.reduce((sum, r) => sum + r.completed, 0);
    const skipped = reports.reduce((sum, r) => sum + r.skipped, 0);
    const total = completed + skipped;
    const latencies = reports.flatMap((r) => r.latenciesMs);

    return {
      completed,
      skipped,
      skippedPercent: total === 0 ? 0 : (skipped / total) * 100,
      p95Ms: percentile95(latencies),
    };
  }
}

/**
 * El nombre con el que aparece un participante en el roster de la sala, o `undefined`.
 *
 * `undefined` no es un fallo: la presencia agregada (salas grandes) no trae participantes,
 * y quien acaba de conectar puede no estar todavía en el roster que el agente tiene. El
 * prompt tiene su etiqueta genérica para eso.
 */
function speakerName(roomId: string, senderId: string): string | undefined {
  const presence = agentChannel(roomId).presence;
  if (presence === undefined || presence.kind !== "detailed") {
    return undefined;
  }
  const participant = presence.participants.find((p) => p.id === senderId);
  const name = participant?.metadata?.displayName;
  return typeof name === "string" && name.trim() !== "" ? name : participant?.username;
}

export function extractionRuntime(options: ExtractionRuntimeOptions): ExtractionRuntime {
  const existing = globalForRuntime.__synapseExtraction;
  if (existing !== undefined) {
    return existing;
  }
  const created = new ExtractionRuntime(options);
  globalForRuntime.__synapseExtraction = created;
  return created;
}
