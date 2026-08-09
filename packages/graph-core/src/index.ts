export type {
  Delta,
  Edge,
  EntityType,
  Graph,
  GraphSnapshot,
  InstanceReport,
  MergeResult,
  Node,
  Proposal,
  ProposedEdge,
  ProposedNode,
  RelationType,
} from "./types.js";

export { applyDelta } from "./delta.js";
export { detectContradiction } from "./contradiction.js";export {
  ENTITY_TYPES,
  RELATION_TYPES,
  isGraph,
  sanitizeProposal,
} from "./guards.js";
export { emptyGraph, mergeProposal, normalizeName } from "./merge.js";
export { renderDocument } from "./document.js";
