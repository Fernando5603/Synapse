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

export { emptyGraph, mergeProposal } from "./merge.js";
export { renderDocument } from "./document.js";
