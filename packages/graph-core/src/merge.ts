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
  "the",
  "a",
  "an",
]);

function stripAccents(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function singularize(word: string): string {
  let stem = word;
  if (stem.endsWith("ies") && stem.length > 4) {
    stem = stem.slice(0, -3) + "y";
  } else if (stem.endsWith("s") && !stem.endsWith("ss") && stem.length > 3) {
    stem = stem.slice(0, -1);
  }
  // Quitar la -e final colapsa el plural de las palabras que terminan en -e con su
  // singular: "databases" -> "database" -> "databas" y "database" -> "databas".
  // Sin este paso cada plural ingl\u00e9s o espa\u00f1ol de esa forma abre un nodo aparte.
  if (stem.endsWith("e") && stem.length > 3) {
    stem = stem.slice(0, -1);
  }
  return stem;
}

export function normalizeName(name: string): string {
  const tokens = stripAccents(name)
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
  const withoutArticles = tokens.filter((token) => !ARTICLES.has(token));
  // Un nombre que es solo un artículo ("A", "The") se queda con sus tokens: vaciarlo
  // fundiría en un mismo nodo cosas que no tienen nada que ver.
  const meaningful = withoutArticles.length > 0 ? withoutArticles : tokens;
  return meaningful.map(singularize).join(" ");
}

function nodeId(type: EntityType, name: string): string {
  const slug = normalizeName(name).replace(/[^a-z0-9]+/g, "-");
  return `${type.toLowerCase()}-${slug}`;
}

// El slug pierde todo lo que no sea alfanum\u00e9rico, as\u00ed que nombres distintos pueden
// reducirse al mismo identificador ("C++" y "C#" dan los dos "concept-c-"). Si dos
// nodos compartieran id, el grafo perder\u00eda uno que el delta ya anunci\u00f3 y los clientes
// que aplican deltas divergir\u00edan del snapshot.
function uniqueNodeId(
  type: EntityType,
  name: string,
  taken: ReadonlyMap<string, Node>,
): string {
  const base = nodeId(type, name);
  if (!taken.has(base)) {
    return base;
  }
  let attempt = 2;
  while (taken.has(`${base}-${attempt}`)) {
    attempt += 1;
  }
  return `${base}-${attempt}`;
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

  function registerName(node: Node): void {
    const normalized = normalizeName(node.name);
    if (!nameToId.has(normalized)) {
      nameToId.set(normalized, node.id);
    }
  }

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

  for (const proposed of proposal.nodes) {
    const key = `${proposed.type}|${normalizeName(proposed.name)}`;
    if (nodesByKey.has(key)) {
      continue;
    }
    const node: Node = {
      id: uniqueNodeId(proposed.type, proposed.name, nodesById),
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
    // Un nodo relacionado consigo mismo no dice nada y ensucia el render.
    if (fromId === toId) {
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
