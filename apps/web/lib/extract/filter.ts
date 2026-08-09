import { roomIdFromChannel } from "../channel";

/** El shape del webhook de Portal para un evento de mensaje (docs-site guides/webhooks). */
export interface WebhookEvent {
  id: string;
  type: string;
  channelId: string;
  data: {
    type?: unknown;
    content?: unknown;
    sender?: { id?: unknown };
    ephemeral?: unknown;
  };
}

export interface TurnSignal {
  kind: "turn";
  roomId: string;
  senderId: string;
  text: string;
}

export interface IgnoreSignal {
  kind: "ignore";
}

export type ClassifyDecision = TurnSignal | IgnoreSignal;

function isTextContent(content: unknown): content is { text: string } {
  return (
    typeof content === "object" &&
    content !== null &&
    typeof (content as { text?: unknown }).text === "string" &&
    (content as { text: string }).text.trim() !== ""
  );
}

/**
 * El filtro de la primera línea del webhook (N21).
 *
 * No es higiene: desde C3.4-B el backend es participante del canal, así que sus
 * `graph.proposal` y los `graph.delta` de la extensión vuelven por el mismo webhook.
 * Sin este filtro, el pipeline se auto-alimenta y el grafo crece solo cuando nadie habla.
 *
 * Solo los mensajes de chat persistentes de una sala `room-*` entran como turno. El
 * namespace se reconoce por el `type` del mensaje: el chat es `message`, los tipos de
 * la extensión son `graph.*`.
 */
export function classifyWebhook(event: WebhookEvent): ClassifyDecision {
  if (event.type !== "message.published") {
    return { kind: "ignore" };
  }

  const roomId = roomIdFromChannel(event.channelId);
  if (roomId === undefined) {
    return { kind: "ignore" };
  }

  // Un efímero no se persiste: Portal no lo entrega por webhook, pero si llegara,
  // no hay nada que extraer de un parpadeo.
  if (event.data.ephemeral === true) {
    return { kind: "ignore" };
  }

  // Los mensajes de la extensión (`graph.*`) y cualquier cosa que no sea chat no entran.
  if (event.data.type !== "message") {
    return { kind: "ignore" };
  }

  if (!isTextContent(event.data.content)) {
    return { kind: "ignore" };
  }

  const senderId = event.data.sender?.id;
  if (typeof senderId !== "string" || senderId === "") {
    return { kind: "ignore" };
  }

  return {
    kind: "turn",
    roomId,
    senderId,
    text: event.data.content.text,
  };
}
