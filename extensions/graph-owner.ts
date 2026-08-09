import {
  defineExtension,
  type BatchRequest,
  type BatchResponse,
  type ExtensionBroadcast,
  type ExtensionContext,
  type ExtensionManifest,
  type SnapshotRequest,
} from "@portalsdk/extension-protocol";
import {
  emptyGraph,
  isGraph,
  mergeProposal,
  sanitizeProposal,
  type Graph,
  type GraphSnapshot,
} from "@synapse/graph-core";

/** El tipo con el que entra una `Proposal`. Parte del contrato congelado. */
const PROPOSAL_TYPE = "graph.proposal";

/** El tipo con el que sale un `Delta` al canal. Parte del contrato congelado. */
const DELTA_TYPE = "graph.delta";

/** Dónde vive el grafo autoritativo entre una instancia y la siguiente. */
const GRAPH_KEY = "graph";

/** Hasta qué batch se ha procesado, junto al epoch que le da sentido al número. */
const BATCH_KEY = "batch";

interface StoredBatch {
  epoch: number;
  seq: number;
}

/**
 * `graph-owner` — dueña del grafo autoritativo de la sala.
 *
 * Es la fuente de verdad del sistema: el grafo no vive en el backend ni en una base de
 * datos, vive aquí. Recibe propuestas por `onBatch`, las funde con `mergeProposal` de
 * `graph-core`, difunde el `Delta` resultante a todo el canal y sirve el grafo entero a
 * quien llega tarde por `onSnapshot`.
 *
 * Los tres caminos —merge, persistencia y late-join— comparten el mismo `#graph`, y
 * `mergeProposal` es la única función que lo cambia. Que el merge viva en un módulo puro
 * y compartido es lo que hace que el cliente que aplica el `Delta` y la extensión que lo
 * produjo no puedan divergir.
 *
 * **La memoria de instancia no es memoria.** Medido en el ticket 04: una instancia se
 * recicla en menos de 45 s de inactividad, y en una discusión real la gente calla más que
 * eso. Por eso cada merge se persiste antes de contestar y cada entrada al código
 * rehidrata primero: sin eso el grafo no daría error, simplemente olvidaría.
 */
class GraphOwner {
  static manifest: ExtensionManifest = {
    namespace: "graph.",
    transport: "ws",
  };

  #ctx: ExtensionContext;

  #graph: Graph = emptyGraph();

  /**
   * La rehidratación, empezada una sola vez y esperada por todos. Portal puede pedir un
   * snapshot mientras hay batches en vuelo, y no promete que `onInit` haya terminado
   * antes del primer `onBatch`, así que quien necesite el grafo espera aquí en vez de
   * confiar en el orden de los handlers.
   */
  #loaded: Promise<void> | undefined;

  /** Qué encontró la rehidratación. Es diagnóstico, y viaja en el snapshot (X1-Q6). */
  #rehydrated = false;

  /** Batches procesados por *esta* instancia. No se persiste: delata el reciclaje. */
  #batches = 0;

  #epoch = -1;

  #lastBatchSeq = -1;

  constructor(ctx: ExtensionContext) {
    this.#ctx = ctx;
  }

  async onInit(): Promise<void> {
    await this.#load();
  }

  async onBatch({ messages, batchSeq, epoch }: BatchRequest): Promise<BatchResponse | void> {
    await this.#load();

    // El `batchSeq` se numera por vida del canal: cuando el canal reinicia vuelve a
    // empezar, y la marca de agua que traíamos de `ctx.storage` —escrita en el canal
    // anterior— rechazaría batches nuevos por traer un número más bajo.
    if (epoch !== this.#epoch) {
      this.#epoch = epoch;
      this.#lastBatchSeq = -1;
    }

    // Portal entrega cada batch **al menos** una vez: tras un fallo de red puede repetir
    // uno ya procesado. El cliente aguanta la reentrega —`applyDelta` es idempotente— y
    // el grafo también —`mergeProposal` deduplica por nombre—, pero la versión no: sin
    // esto un batch repetido la infla y el badge de la sala miente.
    if (batchSeq <= this.#lastBatchSeq) {
      return;
    }
    this.#lastBatchSeq = batchSeq;
    this.#batches += 1;

    // Mismo motivo que el filtro por namespace del webhook: la extensión no puede
    // reaccionar a sus propios `graph.delta` o se alimentaría de su propia salida.
    const proposals = messages.filter((message) => message.type === PROPOSAL_TYPE);
    if (proposals.length === 0) {
      return;
    }

    const broadcasts: ExtensionBroadcast[] = [];
    for (const message of proposals) {
      // Una propuesta por delta, aunque vengan varias en el mismo batch: el criterio (a)
      // se mide por mensaje, y un delta por mensaje es lo que lo deja medible.
      //
      // `sanitizeProposal` es la aduana. El contenido de un mensaje es `unknown` —Portal
      // no lo mira— y esto es lo que la extensión persiste y difunde: lo que no cumple el
      // contrato no entra. Una propuesta ilegible se funde como una propuesta vacía, así
      // que sigue habiendo delta y quien la mandó recibe su acuse igual.
      const { graph, delta } = mergeProposal(
        this.#graph,
        sanitizeProposal(message.content),
      );
      this.#graph = graph;
      broadcasts.push({ type: DELTA_TYPE, content: delta });
    }

    // Persistir antes de contestar: si la instancia muere entre las dos cosas, se pierde
    // el aviso —que el cliente vuelve a recibir en el snapshot— y no el grafo.
    await this.#persist();

    return { broadcasts, snapshotDirty: true };
  }

  /**
   * El grafo entero para quien acaba de llegar. Portal lo entrega en la trama de conexión
   * (`ext.graph` en el cliente), así que una pestaña abierta a mitad de sesión pinta todo
   * de inmediato: no hay replay del historial ni backfill de deltas.
   *
   * `instance` no es del contrato del grafo: es la única ventana que hay a esta extensión
   * desde fuera —no existe `portal logs`— y es lo que permite distinguir un grafo que
   * sobrevivió en memoria de uno releído de `ctx.storage`. Nadie debe depender de él.
   */
  async onSnapshot({ epoch }: SnapshotRequest): Promise<{ snapshot: GraphSnapshot }> {
    await this.#load();
    return {
      snapshot: {
        graph: this.#graph,
        instance: {
          // El epoch de esta petición, no el que se leyó de `ctx.storage`: el guardado lo
          // escribió la instancia anterior, y reportarlo haría que "el epoch no cambió"
          // fuera cierto por construcción en vez de por medida.
          epoch,
          rehydrated: this.#rehydrated,
          batches: this.#batches,
        },
      },
    };
  }

  #load(): Promise<void> {
    // Si la lectura falla, se olvida la promesa: memorizar una rechazada dejaría a esta
    // instancia contestando el mismo error a todo el mundo hasta que la reciclen, que es
    // la forma más cara posible de tener un problema pasajero.
    this.#loaded ??= this.#readStorage().catch((cause: unknown) => {
      this.#loaded = undefined;
      throw cause;
    });
    return this.#loaded;
  }

  async #readStorage(): Promise<void> {
    const stored = await this.#ctx.storage.get(GRAPH_KEY);
    // Un grafo que no cuadra con el contrato se descarta entero en vez de adoptarse a
    // trozos: es de otra versión de la extensión, y media verdad sería peor que empezar.
    if (isGraph(stored)) {
      this.#graph = stored;
      this.#rehydrated = true;
    } else {
      this.#graph = emptyGraph();
      this.#rehydrated = false;
    }

    const batch = await this.#ctx.storage.get<StoredBatch>(BATCH_KEY);
    if (batch !== undefined && typeof batch.seq === "number") {
      this.#epoch = batch.epoch;
      this.#lastBatchSeq = batch.seq;
    }
  }

  async #persist(): Promise<void> {
    await this.#ctx.storage.put(GRAPH_KEY, this.#graph);
    await this.#ctx.storage.put(BATCH_KEY, {
      epoch: this.#epoch,
      seq: this.#lastBatchSeq,
    } satisfies StoredBatch);
  }
}

export default defineExtension(GraphOwner);
