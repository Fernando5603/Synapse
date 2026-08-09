import type { Delta, Edge, Graph, Node } from "./types.js";

/**
 * Aplica un `Delta` autoritativo sobre el espejo local del grafo.
 *
 * Es la contraparte de `mergeProposal`: quien mergea produce el delta, quien lo
 * recibe lo aplica. Los dos lados convergen porque el delta trae los nodos y las
 * aristas ya identificados — aquí no se resuelve ningún nombre ni se acuña ningún id.
 */
export function applyDelta(graph: Graph, delta: Delta): Graph {
  const nodesById = new Map<string, Node>();
  for (const node of graph.nodes) {
    nodesById.set(node.id, node);
  }
  const edgesById = new Map<string, Edge>();
  for (const edge of graph.edges) {
    edgesById.set(edge.id, edge);
  }

  // Los batches llegan al menos una vez, así que un delta puede reentregarse. El id
  // ya existente gana: reaplicarlo no duplica ni reescribe lo que ya se pintó.
  for (const node of delta.addedNodes) {
    if (!nodesById.has(node.id)) {
      nodesById.set(node.id, node);
    }
  }
  for (const edge of delta.addedEdges) {
    if (!edgesById.has(edge.id)) {
      edgesById.set(edge.id, edge);
    }
  }

  return {
    nodes: [...nodesById.values()],
    edges: [...edgesById.values()],
    // La versión solo avanza: un delta reentregado tarde no puede hacer retroceder
    // el badge que dice si esta pantalla está al día.
    version: Math.max(graph.version, delta.version),
  };
}
