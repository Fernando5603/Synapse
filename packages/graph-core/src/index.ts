export type {
  Delta,
  Edge,
  EntityType,
  Graph,
  MergeResult,
  Node,
  Proposal,
  ProposedEdge,
  ProposedNode,
  RelationType,
} from "./types.js";

export { applyDelta } from "./delta.js";
export { emptyGraph, mergeProposal } from "./merge.js";
export { renderDocument } from "./document.js";
