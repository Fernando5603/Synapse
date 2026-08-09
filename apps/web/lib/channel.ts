import type { Delta, Proposal } from "@synapse/graph-core";

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
