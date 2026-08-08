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
export type ChannelContent = ChatContent | CursorContent;

export function isCursorContent(content: ChannelContent): content is CursorContent {
  return typeof content === "object" && content !== null && "x" in content;
}

export function isChatContent(content: ChannelContent): content is ChatContent {
  return typeof content === "object" && content !== null && "text" in content;
}
