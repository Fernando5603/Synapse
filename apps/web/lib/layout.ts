import type { Graph } from "@synapse/graph-core";

export interface Position {
  x: number;
  y: number;
}

export type Positions = ReadonlyMap<string, Position>;

export interface RelaxOptions {
  /** Distancia de reposo entre un nodo y sus vecinos inmediatos. */
  desiredDistance?: number;
  /** Fracción de la corrección aplicada en cada paso; 1 = de golpe. */
  strength?: number;
}

export interface Bounds {
  width: number;
  height: number;
}

const DEFAULT_DESIRED_DISTANCE = 180;
const DEFAULT_STRENGTH = 0.5;
const DEFAULT_BOUNDS: Bounds = { width: 840, height: 600 };
/** Margen al borde del lienzo para que el rótulo del nodo no se corte. */
const EDGE_MARGIN = 40;

/**
 * Sembrado determinista cartesiano: `x` e `y` salen de trozos independientes
 * del hash del `id`, ocupando todo el lienzo con margen. Es una función pura
 * del `id`, sin historial de llegada: tres pantallas que reciben el mismo grafo
 * (incremental o por snapshot) siembran cada nodo en el mismo sitio.
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

/**
 * Relajación estrictamente local contra vecinos inmediatos: mueve solo los
 * nodos conectados por una arista a `nodeId` hacia la distancia de reposo.
 * El nodo ancla y los no vecinos no se tocan; nunca re-layout global.
 */
export function relaxNeighbors(
  graph: Graph,
  positions: Positions,
  nodeId: string,
  options: RelaxOptions = {},
): Positions {
  const desiredDistance = options.desiredDistance ?? DEFAULT_DESIRED_DISTANCE;
  const strength = options.strength ?? DEFAULT_STRENGTH;

  const anchor = positions.get(nodeId);
  if (anchor === undefined) {
    return positions;
  }

  const next = new Map<string, Position>();
  for (const [id, p] of positions) {
    next.set(id, { ...p });
  }

  for (const edge of graph.edges) {
    const neighborId =
      edge.from === nodeId ? edge.to : edge.to === nodeId ? edge.from : undefined;
    if (neighborId === undefined) {
      continue;
    }
    const neighbor = next.get(neighborId);
    if (neighbor === undefined) {
      continue;
    }
    const dx = neighbor.x - anchor.x;
    const dy = neighbor.y - anchor.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) {
      continue;
    }
    const unitX = dx / distance;
    const unitY = dy / distance;
    const newDistance = distance + (desiredDistance - distance) * strength;
    neighbor.x = anchor.x + unitX * newDistance;
    neighbor.y = anchor.y + unitY * newDistance;
  }

  return next;
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
