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
