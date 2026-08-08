import type {
  Delta,
  Edge,
  EntityType,
  Graph,
  MergeResult,
  Node,
  Proposal,
  RelationType,
} from "./types.js";

const ARTICLES = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
]);

function stripAccents(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function singularize(word: string): string {
  if (word.length <= 2) {
    return word;
  }
  if (word.endsWith("ies") && word.length > 4) {
    return word.slice(0, -3) + "y";
  }
  if (word.endsWith("es") && word.length > 4) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && word.length > 3) {
    return word.slice(0, -1);
  }
  return word;
}

function normalizeName(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0 && !ARTICLES.has(token))
    .map(singularize)
    .join(" ");
}

function nodeId(type: EntityType, name: string): string {
  const slug = normalizeName(name).replace(/[^a-z0-9]+/g, "-");
  return `${type.toLowerCase()}-${slug}`;
}

function edgeId(type: RelationType, from: string, to: string): string {
  return `${type.toLowerCase()}-${from}-${to}`;
}

export function emptyGraph(): Graph {
  return { nodes: [], edges: [], version: 0 };
}

export function mergeProposal(graph: Graph, proposal: Proposal): MergeResult {
  const nodesByKey = new Map<string, Node>();
  const nodesById = new Map<string, Node>();
  const nameToId = new Map<string, string>();

  for (const node of graph.nodes) {
    nodesByKey.set(`${node.type}|${normalizeName(node.name)}`, node);
    nodesById.set(node.id, node);
    registerName(node);
  }

  const edgesByKey = new Map<string, Edge>();
  for (const edge of graph.edges) {
    edgesByKey.set(edge.id, edge);
  }

  const addedNodes: Node[] = [];
  const addedEdges: Edge[] = [];

  function registerName(node: Node): void {
    const normalized = normalizeName(node.name);
    if (!nameToId.has(normalized)) {
      nameToId.set(normalized, node.id);
    }
  }

  for (const proposed of proposal.nodes) {
    const key = `${proposed.type}|${normalizeName(proposed.name)}`;
    if (nodesByKey.has(key)) {
      continue;
    }
    const node: Node = {
      id: nodeId(proposed.type, proposed.name),
      type: proposed.type,
      name: proposed.name,
    };
    if (proposed.proposedBy !== undefined) {
      node.proposedBy = proposed.proposedBy;
    }
    nodesByKey.set(key, node);
    nodesById.set(node.id, node);
    registerName(node);
    addedNodes.push(node);
  }

  for (const proposed of proposal.edges) {
    const fromId = nameToId.get(normalizeName(proposed.from));
    const toId = nameToId.get(normalizeName(proposed.to));
    if (fromId === undefined || toId === undefined) {
      continue;
    }
    const id = edgeId(proposed.type, fromId, toId);
    if (edgesByKey.has(id)) {
      continue;
    }
    const edge: Edge = {
      id,
      type: proposed.type,
      from: fromId,
      to: toId,
    };
    edgesByKey.set(id, edge);
    addedEdges.push(edge);
  }

  const version = graph.version + 1;
  return {
    graph: {
      nodes: [...nodesById.values()],
      edges: [...edgesByKey.values()],
      version,
    },
    delta: { addedNodes, addedEdges, version },
  };
}
