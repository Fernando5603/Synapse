import type { Graph } from "@synapse/graph-core";

/**
 * Las derivaciones del grafo que el render necesita y que no dependen de D3 ni del DOM.
 *
 * Están aquí y no dentro del canvas porque son la parte del render que sí tiene reglas
 * —cuánto crece un nodo con sus relaciones, a quién ilumina el hover— y esas reglas se
 * pueden equivocar en silencio: un nodo que crece sin techo se come la pantalla, y un
 * grado que cuenta la misma arista dos veces miente sobre la importancia del nodo.
 */

export const NODE_RADIUS = { min: 16, max: 42 } as const;

/**
 * Cuántas relaciones toca cada nodo. Las aristas cuentan por los dos extremos: en este
 * grafo "importante" significa conectado, no origen ni destino.
 */
export function degrees(graph: Graph): Map<string, number> {
  const counted = new Map<string, number>();
  for (const node of graph.nodes) {
    counted.set(node.id, 0);
  }
  for (const edge of graph.edges) {
    if (counted.has(edge.from)) {
      counted.set(edge.from, counted.get(edge.from)! + 1);
    }
    if (counted.has(edge.to)) {
      counted.set(edge.to, counted.get(edge.to)! + 1);
    }
  }
  return counted;
}

/**
 * El radio de un nodo según su grado.
 *
 * Crece con la raíz del grado y no linealmente, que es lo que hace que el **área** —lo
 * que el ojo compara— sea proporcional a las relaciones. Y tiene techo: en un grafo de
 * cuarenta nodos el más conectado puede tener veinte aristas, y sin tope taparía a todos
 * los demás.
 */
export function nodeRadius(degree: number): number {
  const grown = NODE_RADIUS.min + Math.sqrt(Math.max(0, degree)) * 6;
  return Math.min(NODE_RADIUS.max, grown);
}

/**
 * Los nodos a un salto de `nodeId`, él incluido. Es el conjunto que queda iluminado
 * cuando el puntero se posa sobre un nodo; el resto del grafo se apaga.
 */
export function neighborhood(graph: Graph, nodeId: string): Set<string> {
  const near = new Set<string>([nodeId]);
  for (const edge of graph.edges) {
    if (edge.from === nodeId) {
      near.add(edge.to);
    } else if (edge.to === nodeId) {
      near.add(edge.from);
    }
  }
  return near;
}
