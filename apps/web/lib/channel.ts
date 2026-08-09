import type { Delta, Proposal } from "@synapse/graph-core";

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
