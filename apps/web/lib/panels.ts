/**
 * Los anchos de los paneles laterales.
 *
 * El ancho lo decide el usuario arrastrando, así que hay dos cosas que no pueden fallar:
 * que un arrastre largo no se coma el lienzo (que es el producto), y que el ancho
 * guardado de la sesión anterior no pueda dejar la pantalla inservible al volver.
 * Las dos son la misma función.
 */

export const CHAT_WIDTH = { min: 280, max: 560, initial: 340 } as const;
export const ROSTER_WIDTH = { min: 180, max: 320, initial: 208 } as const;

export interface WidthRange {
  min: number;
  max: number;
}

/**
 * El ancho aplicable a partir de uno pedido. Fuera de rango se recorta al extremo más
 * cercano; lo que no es un número —un `localStorage` de otra versión, un `NaN` de un
 * arrastre raro— cae al valor por defecto en vez de propagarse a un `style`.
 */
export function clampWidth(
  requested: unknown,
  range: WidthRange,
  fallback: number,
): number {
  if (typeof requested !== "number" || !Number.isFinite(requested)) {
    return fallback;
  }
  return Math.min(range.max, Math.max(range.min, Math.round(requested)));
}

/**
 * El ancho del chat mientras se arrastra su borde izquierdo.
 *
 * El chat está pegado a la derecha, así que arrastrar hacia la izquierda lo **ensancha**:
 * el ancho es la distancia del puntero al borde derecho de la ventana, no su coordenada.
 */
export function widthFromDragX(pointerX: number, viewportWidth: number): number {
  return clampWidth(viewportWidth - pointerX, CHAT_WIDTH, CHAT_WIDTH.initial);
}
