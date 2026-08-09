import {
  applyDelta,
  isGraph,
  type Delta,
  type Graph,
  type Proposal,
} from "@synapse/graph-core";

/**
 * El canal de una sala.
 *
 * El prefijo no es decorativo: `portal.config.ts` engancha la extensión con el template
 * `room-*`, y un template de Portal exige prefijo fijo. Un slug pelado dejaría la sala sin
 * `graph-owner`. Cliente y agente headless tienen que coincidir aquí o hablarían a canales
 * distintos, así que la regla vive en un solo sitio.
 */
export function channelIdFor(roomId: string): string {
  return `room-${roomId}`;
}

/** Tipo de mensaje con el que la extensión `graph-owner` difunde cada delta. */
export const GRAPH_DELTA_TYPE = "graph.delta";

/** Tipo de mensaje con el que se le entrega una propuesta a la extensión. */
export const GRAPH_PROPOSAL_TYPE = "graph.proposal";

/**
 * El handle con el que `portal.config.ts` engancha la extensión al canal. El SDK entrega
 * los snapshots de extensión en la trama de conexión indexados por él, así que este
 * nombre y el de la config son el mismo o el late-join no encuentra nada.
 */
const GRAPH_EXTENSION_HANDLE = "graph";

/**
 * El grafo a pintar, incorporando el snapshot que la extensión sirvió en la trama de
 * conexión. Es todo el late-join: quien entra a mitad de sesión no reconstruye nada desde
 * el historial, lee el grafo entero de su dueña.
 *
 * **Un snapshot es un delta que lo añade todo**, así que se adopta con `applyDelta` en
 * vez de sustituir el grafo local. No es un rodeo: el SDK reemplaza esta trama en cada
 * `ready`, incluidas las reconexiones, y para entonces pueden haberse pintado deltas que
 * el snapshot no traía. Sustituir devolvería la pantalla a un pasado; `applyDelta` une
 * los dos y se queda con la versión más alta.
 *
 * Devuelve el grafo recibido, sin tocar, mientras no haya snapshot que leer: antes de
 * `ready`, con la extensión degradada (que es clave **ausente**, no nula) o con un blob
 * que no cumple el contrato. Vaciar la pantalla sería peor que dejarla como está.
 */
export function graphWithSnapshot(
  local: Graph,
  ext: Record<string, unknown> | undefined,
): Graph {
  const blob = ext?.[GRAPH_EXTENSION_HANDLE];
  if (typeof blob !== "object" || blob === null) {
    return local;
  }
  const snapshot = (blob as { graph?: unknown }).graph;
  if (!isGraph(snapshot)) {
    return local;
  }
  return applyDelta(local, {
    addedNodes: snapshot.nodes,
    addedEdges: snapshot.edges,
    version: snapshot.version,
  });
}

/** Contenido de un mensaje de chat persistente. */
export interface ChatContent {
  text: string;
}

/** Contenido de un mensaje efímero de cursor. El `type` del envelope es "cursor". */
export interface CursorContent {
  x: number;
  y: number;
}

/** Unión de contenidos que viajan por el canal. */
export type ChannelContent = ChatContent | CursorContent | Delta | Proposal;

export function isCursorContent(content: ChannelContent): content is CursorContent {
  return typeof content === "object" && content !== null && "x" in content;
}

export function isChatContent(content: ChannelContent): content is ChatContent {
  return typeof content === "object" && content !== null && "text" in content;
}

export function isDeltaContent(content: ChannelContent): content is Delta {
  return typeof content === "object" && content !== null && "addedNodes" in content;
}
