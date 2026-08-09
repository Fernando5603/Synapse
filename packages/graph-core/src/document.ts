import type { Edge, Graph, Node, RelationType } from "./types.js";

const SUPPORTING: RelationType[] = ["SUPPORTS", "ELABORATES"];

function byId(graph: Graph): Map<string, Node> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

function incomingOfType(graph: Graph, nodeId: string, types: RelationType[]): Edge[] {
  return graph.edges.filter((edge) => edge.to === nodeId && types.includes(edge.type));
}

/**
 * La cadena de soporte de un nodo: los Claims/Evidence que lo apoyan directa o
 * transitivamente por SUPPORTS/ELABORATES, con cada eslabón una vez.
 */
function supportChain(
  graph: Graph,
  nodes: Map<string, Node>,
  nodeId: string,
  visited: Set<string>,
): Node[] {
  const chain: Node[] = [];
  for (const edge of incomingOfType(graph, nodeId, SUPPORTING)) {
    const support = nodes.get(edge.from);
    if (support === undefined || visited.has(support.id)) {
      continue;
    }
    visited.add(support.id);
    chain.push(support);
    chain.push(...supportChain(graph, nodes, support.id, visited));
  }
  return chain;
}

function section(lines: string[], title: string, rows: string[]): void {
  if (rows.length === 0) {
    return;
  }
  lines.push(`## ${title}`);
  lines.push("");
  for (const row of rows) {
    lines.push(row);
  }
  lines.push("");
}

export function renderDocument(graph: Graph): string {
  const nodes = byId(graph);
  const lines: string[] = [];

  lines.push("# Documento de sesión");
  lines.push("");
  lines.push(`Versión del grafo: ${graph.version}`);
  lines.push("");

  // Las ideas de la conversación: los nodos del grafo que no son Person. Es lo que el
  // documento no decía y por eso parecía "cualquier cosa": si el pipeline extrajo Claims
  // y Concepts (la sustancia), el markdown solo listaba Decisiones/Preguntas/Contradicciones
  // y salía casi vacío.
  const ideaRows = graph.nodes
    .filter((node) => node.type !== "Person")
    .map((node) => `- [${node.type}] ${node.name}`);
  section(lines, "Ideas de la conversación", ideaRows);

  // Las relaciones entre las ideas, como frases.
  const relationRows: string[] = [];
  for (const edge of graph.edges) {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (from === undefined || to === undefined) {
      continue;
    }
    relationRows.push(`- ${edge.type}: ${from.name} → ${to.name}`);
  }
  section(lines, "Relaciones", relationRows);

  // Decisiones con su cadena de soporte.
  const decisionRows: string[] = [];
  for (const decision of graph.nodes.filter((node) => node.type === "Decision")) {
    decisionRows.push("");
    decisionRows.push(`### ${decision.name}`);
    const chain = supportChain(graph, nodes, decision.id, new Set([decision.id]));
    if (chain.length > 0) {
      decisionRows.push("");
      decisionRows.push("Se apoya en:");
      for (const support of chain) {
        decisionRows.push(`- ${support.name}`);
      }
    }
  }
  section(lines, "Decisiones", decisionRows);

  // Contradicciones sin resolver.
  const contradictionRows: string[] = [];
  for (const contradiction of graph.edges.filter((edge) => edge.type === "CONTRADICTS")) {
    const from = nodes.get(contradiction.from);
    const to = nodes.get(contradiction.to);
    if (from === undefined || to === undefined) {
      continue;
    }
    contradictionRows.push(`- ${from.name} contradice a ${to.name}`);
  }
  section(lines, "Contradicciones sin resolver", contradictionRows);

  // Questions sin arista ANSWERS.
  const answered = new Set(
    graph.edges
      .filter((edge) => edge.type === "ANSWERS")
      .map((edge) => edge.to),
  );
  const openRows = graph.nodes
    .filter((node) => node.type === "Question" && !answered.has(node.id))
    .map((question) => `- ${question.name}`);
  section(lines, "Lo que quedó abierto", openRows);

  return lines.join("\n");
}
