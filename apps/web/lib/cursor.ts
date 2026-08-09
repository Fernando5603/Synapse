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
 * El prefijo con el que un cursor viaja por el carril de actividad.
 *
 * **Por qué la actividad y no algo más obvio.** Los otros dos carriles están medidos y
 * los dos están muertos para esto:
 *
 * - *Efímero*: el SDK (`MessageBuffer.ingest`, core 0.1.5) hace
 *   `if (msg.seq === null || msg.ephemeral) continue` antes de emitir el evento
 *   `message`. Se envía y no lo recibe nadie. Medido con dos clientes: 10 enviados, 0
 *   recibidos.
 * - *Metadata de presencia*: el protocolo promete que un `meta` se «re-anuncia por
 *   presence deltas», pero el servidor no lo hace. Medido: 10 `setMetadata` seguidos, 0
 *   eventos de presencia en el otro cliente.
 *
 * El carril de actividad sí entrega, y su `kind` es texto libre — de ahí que la posición
 * viaje dentro del propio `kind`. Medido a 8 Hz: 40 enviados, 40 recibidos, hueco medio
 * 138 ms, la conexión aguanta. No es para lo que se diseñó el campo, y por eso está
 * escrito aquí: quien lo lea después tiene que saber que las dos alternativas limpias ya
 * se probaron.
 */
export const CURSOR_ACTIVITY_PREFIX = "xy|";

/** La posición como `kind` de actividad. Enteros: medio píxel no lo ve nadie. */
export function encodeCursorActivity(x: number, y: number): string {
  return `${CURSOR_ACTIVITY_PREFIX}${Math.round(x)}|${Math.round(y)}`;
}

/** La posición dentro de un `kind`, o `undefined` si ese `kind` no es un cursor. */
export function decodeCursorActivity(kind: string): CursorPosition | undefined {
  if (!kind.startsWith(CURSOR_ACTIVITY_PREFIX)) {
    return undefined;
  }
  const [rawX, rawY] = kind.slice(CURSOR_ACTIVITY_PREFIX.length).split("|");
  const x = Number(rawX);
  const y = Number(rawY);
  if (rawX === undefined || rawY === undefined || !Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }
  return { x, y };
}

/**
 * La última posición de cada participante a partir de la actividad viva del canal.
 *
 * «La última» es la de más adelante en la lista: el SDK guarda la actividad en un `Map`
 * por `userId:kind`, y como cada posición es un `kind` distinto, la nueva se **añade** al
 * final. Las viejas siguen ahí hasta que expiran a los cinco segundos, así que quedarse
 * con la primera daría un cursor congelado cinco segundos por detrás.
 *
 * Excluye la propia: nadie se pinta su puntero, que ya lo dibuja el sistema operativo.
 */
export function cursorsFromActivity(
  activity: readonly { userId: string; kind: string }[],
  selfId: string | undefined,
): Map<string, CursorPosition> {
  const positions = new Map<string, CursorPosition>();
  for (const entry of activity) {
    if (entry.userId === selfId) {
      continue;
    }
    const position = decodeCursorActivity(entry.kind);
    if (position !== undefined) {
      positions.set(entry.userId, position);
    }
  }
  return positions;
}

/**
 * Lee la última posición conocida desde la metadata de presencia. Es el fallback del
 * late-join: quien entra ve dónde estaba cada uno sin esperar a que muevan el ratón,
 * porque la metadata sí viaja en la trama de conexión. Lo que no hace es actualizarse
 * sola a mitad de sesión — de eso se encarga el carril de actividad, arriba.
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

/**
 * Un paso de interpolación de `current` hacia `target`.
 *
 * La presencia llega a ~10 Hz, no a 60: pintar la posición cruda daría un cursor que
 * salta. Esto lo acerca una fracción `alpha` por fotograma, que es lo que convierte diez
 * muestras por segundo en movimiento continuo. Cuando ya está encima (menos de un cuarto
 * de píxel) devuelve el objetivo exacto, para que el bucle pueda pararse en vez de
 * perseguir un residuo infinito.
 */
export function stepTowards(
  current: CursorPosition,
  target: CursorPosition,
  alpha: number,
): CursorPosition {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) {
    return { x: target.x, y: target.y };
  }
  return { x: current.x + dx * alpha, y: current.y + dy * alpha };
}
