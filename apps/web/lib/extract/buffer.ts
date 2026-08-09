export interface Turn {
  id: string;
  text: string;
  at: number;
  senderId?: string;
  /**
   * El nombre con el que se presenta quien habló, resuelto desde la presencia del canal.
   * Va al prompt: sin él, los turnos se numeran por posición en la ventana y la misma
   * persona cambia de etiqueta entre un lote y el siguiente.
   */
  speaker?: string;
}

/**
 * Acumula un turno al final del buffer. Los turnos llegan del webhook en orden de
 * publicación.
 *
 * El webhook es at-least-once: una reentrega del mismo `id` no duplica el turno. Es la
 * misma decisión que el `applyDelta` del 06 toma con los deltas repetidos.
 */
export function collectTurn(turns: readonly Turn[], turn: Turn): Turn[] {
  if (turns.some((existing) => existing.id === turn.id)) {
    return [...turns];
  }
  return [...turns, turn];
}

/**
 * ¿Está el lote listo? El debounce cierra el lote `debounceMs` después del
 * último turno. Un buffer vacío no tiene lote que cerrar.
 */
export function batchDue(
  turns: readonly Turn[],
  now: number,
  debounceMs: number,
): boolean {
  if (turns.length === 0) {
    return false;
  }
  const last = turns[turns.length - 1]!;
  return now - last.at >= debounceMs;
}

/**
 * La ventana de contexto: los últimos `size` turnos. Es lo que le da al LLM la
 * conversación reciente sin pasarse del presupuesto de R1.
 */
export function contextWindow(turns: readonly Turn[], size: number): Turn[] {
  return turns.slice(-size);
}
