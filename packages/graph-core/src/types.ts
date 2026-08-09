export type EntityType =
  | "Claim"
  | "Concept"
  | "Question"
  | "Evidence"
  | "Person"
  | "Decision";

export type RelationType =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "ELABORATES"
  | "ANSWERS"
  | "PROPOSED_BY"
  | "RESOLVES";

export interface Node {
  id: string;
  type: EntityType;
  name: string;
  proposedBy?: string;
}

export interface Edge {
  id: string;
  type: RelationType;
  from: string;
  to: string;
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
  version: number;
}

export interface ProposedNode {
  type: EntityType;
  name: string;
  proposedBy?: string;
}

export interface ProposedEdge {
  type: RelationType;
  from: string;
  to: string;
}

export interface Proposal {
  nodes: ProposedNode[];
  edges: ProposedEdge[];
}

export interface Delta {
  addedNodes: Node[];
  addedEdges: Edge[];
  version: number;
}

export interface MergeResult {
  graph: Graph;
  delta: Delta;
}

/**
 * Lo que la extensión `graph-owner` sirve en la trama de conexión, y lo que lee quien
 * entra a mitad de sesión. El cliente lo encuentra en `ext.graph` (`graph` es el handle
 * con el que `portal.config.ts` engancha la extensión).
 *
 * El `graph` es el contrato congelado. `instance` no: es diagnóstico —la única ventana a
 * una extensión desplegada desde fuera— y nada del producto debe depender de él.
 */
export interface GraphSnapshot {
  graph: Graph;
  instance: InstanceReport;
}

/** Lo que una instancia de la extensión sabe de sí misma. */
export interface InstanceReport {
  /** Sube cada vez que el canal reinicia. */
  epoch: number;
  /** `true` si el grafo se releyó de `ctx.storage` al arrancar esta instancia. */
  rehydrated: boolean;
  /** Batches procesados por esta instancia. Vuelve a cero cuando se recicla. */
  batches: number;
}
