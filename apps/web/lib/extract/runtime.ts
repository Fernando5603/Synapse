import type { Proposal } from "@synapse/graph-core";
import { agentChannel, propose, watchDeltas } from "@/lib/agent";
import { createMirror, type GraphMirror } from "./mirror";
import { createPipeline, type Pipeline } from "./pipeline";
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
      deliver: async (room: string, proposal: Proposal) => {
        const outcome = await propose(room, proposal);
        if (outcome.delta === undefined) {
          throw new Error(`El agente no recibió el delta de la propuesta de ${room}.`);
        }
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
