export interface Position {
  x: number;
  y: number;
}

export interface Bounds {
  width: number;
  height: number;
}

const DEFAULT_BOUNDS: Bounds = { width: 840, height: 600 };
/** Margen al borde del lienzo para que el rótulo del nodo no se corte. */
const EDGE_MARGIN = 40;

/**
 * Sembrado determinista cartesiano: `x` e `y` salen de trozos independientes
 * del hash del `id`, ocupando todo el lienzo con margen. Es una función pura
 * del `id`, sin historial de llegada: tres pantallas que reciben el mismo grafo
 * (incremental o por snapshot) siembran cada nodo en el mismo sitio.
 *
 * Desde que el lienzo usa `d3-force`, esta posición dejó de ser la definitiva para
 * ser el **ancla**: la simulación tira de cada nodo hacia ella con una fuerza floja.
 * Sigue siendo lo que sostiene la historia 29 —que los tres vean el mismo grafo—
 * porque es lo único del layout que no depende del orden de llegada.
 */
export function seedPosition(
  nodeId: string,
  bounds: Bounds = DEFAULT_BOUNDS,
): Position {
  const hash = fnv1a(nodeId);
  const usableWidth = bounds.width - EDGE_MARGIN * 2;
  const usableHeight = bounds.height - EDGE_MARGIN * 2;
  const x =
    EDGE_MARGIN + ((hash % 10000) / 10000) * usableWidth;
  const y =
    EDGE_MARGIN + (((hash >>> 16) % 10000) / 10000) * usableHeight;
  return { x: Math.round(x), y: Math.round(y) };
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
