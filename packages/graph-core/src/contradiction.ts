import type { Graph, Node, Proposal } from "./types.js";
import { normalizeName } from "./merge.js";

export interface ContradictionHit {
  targetUserId: string;
  claimId: string;
}

/**
 * Detecta si una propuesta contradice un `Claim` ajeno, y a quién avisar.
 *
 * Es aproximada por construcción: mira el estado del grafo **anterior al merge**. Dispara
 * si la propuesta trae una arista `CONTRADICTS` cuyo `to` (el Claim contradicho) ya existe
 * en el grafo, tiene `proposedBy` hacia un usuario, y ese usuario no es quien origina la
 * propuesta — nadie se notifica a sí mismo.
 *
 * Vive en `graph-core` y la llama el backend sobre su espejo, antes de entregar la
 * propuesta a la extensión. La regla exacta del spec: un `CONTRADICTS` hacia un `Claim`
 * con `PROPOSED_BY` al usuario X, con X ≠ autor del mensaje.
 */
export function detectContradiction(
  graph: Graph,
  proposal: Proposal,
  authorId: string,
): ContradictionHit | null {
  const nodesById = new Map<string, Node>(graph.nodes.map((n) => [n.id, n]));

  for (const edge of proposal.edges) {
    if (edge.type !== "CONTRADICTS") {
      continue;
    }
    // La propuesta refiere por nombre; el id se resuelve con la misma normalización
    // que `mergeProposal`, así "El Modelo Gratis No Basta" y "el modelo gratis no basta"
    // apuntan al mismo nodo.
    const contradictedId = idForName(graph, edge.to);
    if (contradictedId === null) {
      continue;
    }
    const contradicted = nodesById.get(contradictedId);
    if (contradicted === undefined || contradicted.type !== "Claim") {
      continue;
    }
    if (contradicted.proposedBy === undefined || contradicted.proposedBy === authorId) {
      continue;
    }
    return { targetUserId: contradicted.proposedBy, claimId: contradicted.id };
  }

  return null;
}

function idForName(graph: Graph, name: string): string | null {
  const normalized = normalizeName(name);
  for (const node of graph.nodes) {
    if (normalizeName(node.name) === normalized) {
      return node.id;
    }
  }
  return null;
}
