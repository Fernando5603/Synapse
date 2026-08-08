import { resolveDisplayName, type Me, type Participant } from "./display";

export interface CursorPosition {
  x: number;
  y: number;
}

export interface RemoteCursor extends CursorPosition {
  id: string;
  displayName: string;
}

/**
 * Throttle del envío del cursor: solo emite cuando ha pasado `interval` desde
 * el último envío. `lastEmittedAt` es undefined la primera vez → emite.
 */
export function shouldEmitCursor(
  lastEmittedAt: number | undefined,
  now: number,
  interval: number,
): boolean {
  return lastEmittedAt === undefined || now - lastEmittedAt >= interval;
}

/**
 * Lee la última posición conocida desde la metadata de presencia. Es lo que
 * permite al que entra tarde ver dónde está cada participante sin esperar a
 * que muevan el ratón.
 */
export function cursorFromMetadata(
  metadata: Record<string, unknown> | undefined,
): CursorPosition | undefined {
  const cursor = metadata?.cursor;
  if (typeof cursor !== "object" || cursor === null) {
    return undefined;
  }
  const { x, y } = cursor as { x?: unknown; y?: unknown };
  if (typeof x !== "number" || typeof y !== "number") {
    return undefined;
  }
  return { x, y };
}

/**
 * Cursores de los demás participantes fusionando las dos fuentes de posición:
 * los efímeros en vivo (movimiento real) ganan sobre la metadata (última
 * posición conocida, el fallback del late-join). Excluye a `me` y solo incluye
 * a quienes tienen posición en alguna fuente. Atribuye con `resolveDisplayName`.
 */
export function mergeRemoteCursors(
  me: Me | undefined,
  participants: readonly Participant[],
  live: ReadonlyMap<string, CursorPosition>,
): RemoteCursor[] {
  const cursors: RemoteCursor[] = [];
  for (const participant of participants) {
    if (me !== undefined && participant.id === me.id) {
      continue;
    }
    const position = live.get(participant.id) ?? cursorFromMetadata(participant.metadata);
    if (position === undefined) {
      continue;
    }
    cursors.push({
      ...position,
      id: participant.id,
      displayName: resolveDisplayName(participant, me, participants),
    });
  }
  return cursors;
}
