import {
  defineExtension,
  type BatchRequest,
  type ExtensionManifest,
} from "@portalsdk/extension-protocol";
import type { Delta } from "@synapse/graph-core";

/**
 * El delta que esta versión de la extensión devuelve siempre, pase lo que pase.
 *
 * Los ids siguen el esquema que acuña `mergeProposal` (`<tipo>-<nombre normalizado>`)
 * para que el cliente no distinga esta mentira de un delta real: cuando el ticket 06
 * sustituya el valor fijo por el merge de verdad, el cliente no cambia.
 */
const FAKE_DELTA: Omit<Delta, "version"> = {
  addedNodes: [
    { id: "concept-latency", type: "Concept", name: "latency" },
    {
      // `mor`, no `more`: la normalización le quita la -e final a las palabras que la
      // tienen. Estos ids salen de correr `mergeProposal` sobre la propuesta de demo,
      // no de escribirlos a mano — si se inventan, el merge del 06 los acuña distintos
      // y el mismo Claim aparece dos veces en las pantallas que ya aplicaron la mentira.
      id: "claim-latency-matter-mor-than-perfection",
      type: "Claim",
      name: "latency matters more than perfection",
    },
  ],
  addedEdges: [
    {
      id: "elaborates-claim-latency-matter-mor-than-perfection-concept-latency",
      type: "ELABORATES",
      from: "claim-latency-matter-mor-than-perfection",
      to: "concept-latency",
    },
  ],
};

/**
 * `graph-owner` — dueña del grafo autoritativo de la sala.
 *
 * En este ticket todavía no hay grafo ni merge: recibe cualquier propuesta del namespace
 * `graph.` y devuelve el mismo delta. Lo que sí queda fijado es el camino —
 * `send()` del cliente → `onBatch` → `return` → todas las pantallas — y el contrato de
 * datos que viaja por él.
 */
class GraphOwner {
  static manifest: ExtensionManifest = {
    namespace: "graph.",
    transport: "ws",
  };

  // La versión sí avanza de verdad: es lo que el badge de la sala muestra, y sube una
  // vez por batch aunque el delta no traiga nada nuevo. Vive en memoria hasta que el
  // ticket 06 traiga `ctx.storage`.
  #version = 0;

  #lastBatchSeq = -1;

  onBatch({ messages, batchSeq }: BatchRequest) {
    // Portal entrega cada batch **al menos** una vez: tras un fallo de red puede repetir
    // uno ya procesado. El cliente aguanta la reentrega —`applyDelta` es idempotente—
    // pero la versión no: sin esto, un batch repetido la infla y el badge miente.
    if (batchSeq <= this.#lastBatchSeq) {
      return;
    }
    this.#lastBatchSeq = batchSeq;

    // Mismo motivo que el filtro por namespace del webhook: la extensión no puede
    // reaccionar a sus propios `graph.delta` o se alimentaría de su propia salida.
    const proposals = messages.filter((message) => message.type === "graph.proposal");
    if (proposals.length === 0) {
      return;
    }

    this.#version += 1;
    const delta: Delta = { ...FAKE_DELTA, version: this.#version };

    // El delta sale como valor de retorno, no como un publish aparte: es Portal quien
    // lo difunde al canal, y es lo que hace que llegue a las tres pantallas a la vez.
    return {
      broadcasts: [{ type: "graph.delta", content: delta }],
    };
  }
}

export default defineExtension(GraphOwner);
