import type {
  Edge,
  EntityType,
  Graph,
  Node,
  Proposal,
  ProposedEdge,
  ProposedNode,
  RelationType,
} from "./types.js";

/**
 * El esquema cerrado del contrato, ahora también en tiempo de ejecución.
 *
 * El prompt del extractor, el script de evaluación y estos guards tienen que hablar de
 * los mismos seis tipos: si cada uno lleva su propia lista, el día que el esquema cambie
 * uno se queda atrás en silencio.
 */
export const ENTITY_TYPES: readonly EntityType[] = [
  "Claim",
  "Concept",
  "Question",
  "Evidence",
  "Person",
  "Decision",
];

export const RELATION_TYPES: readonly RelationType[] = [
  "SUPPORTS",
  "CONTRADICTS",
  "ELABORATES",
  "ANSWERS",
  "PROPOSED_BY",
  "RESOLVES",
];

const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);
const RELATION_TYPE_SET = new Set<string>(RELATION_TYPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Una cadena con algo dentro: un nombre en blanco no identifica ningún concepto. */
function isName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Lee una `Proposal` de un valor que viene de fuera del sistema —el LLM, el mensaje de
 * otro cliente, cualquiera que sepa el tipo de mensaje— quedándose con lo que cumple el
 * contrato y descartando el resto.
 *
 * Filtra en vez de rechazar entera, que es la misma política que ya sigue
 * `mergeProposal` con las aristas que no resuelven: una propuesta de seis nodos con un
 * tipo mal escrito aporta cinco, no cero. Y devuelve una propuesta vacía para lo que ni
 * siquiera tiene forma de propuesta, así que quien la mergea no necesita un caso aparte:
 * una propuesta ilegible es una propuesta sin novedades.
 *
 * Reconstruye cada entrada campo a campo a propósito. Lo que llega puede traer
 * acompañantes —un `id` inventado, una `confidence`— y el grafo es lo que se persiste y
 * se difunde: solo entra lo que el contrato nombra.
 */
export function sanitizeProposal(value: unknown): Proposal {
  if (!isRecord(value)) {
    return { nodes: [], edges: [] };
  }

  const nodes: ProposedNode[] = [];
  if (Array.isArray(value.nodes)) {
    for (const candidate of value.nodes) {
      if (!isRecord(candidate)) {
        continue;
      }
      const { type, name, proposedBy } = candidate;
      if (typeof type !== "string" || !ENTITY_TYPE_SET.has(type) || !isName(name)) {
        continue;
      }
      const node: ProposedNode = { type: type as EntityType, name };
      if (typeof proposedBy === "string") {
        node.proposedBy = proposedBy;
      }
      nodes.push(node);
    }
  }

  const edges: ProposedEdge[] = [];
  if (Array.isArray(value.edges)) {
    for (const candidate of value.edges) {
      if (!isRecord(candidate)) {
        continue;
      }
      const { type, from, to } = candidate;
      if (typeof type !== "string" || !RELATION_TYPE_SET.has(type)) {
        continue;
      }
      if (!isName(from) || !isName(to)) {
        continue;
      }
      edges.push({ type: type as RelationType, from, to });
    }
  }

  return { nodes, edges };
}

function isNode(value: unknown): value is Node {
  if (!isRecord(value)) {
    return false;
  }
  const { id, type, name, proposedBy } = value;
  return (
    isName(id) &&
    typeof type === "string" &&
    ENTITY_TYPE_SET.has(type) &&
    typeof name === "string" &&
    (proposedBy === undefined || typeof proposedBy === "string")
  );
}

function isEdge(value: unknown): value is Edge {
  if (!isRecord(value)) {
    return false;
  }
  const { id, type, from, to } = value;
  return (
    isName(id) &&
    typeof type === "string" &&
    RELATION_TYPE_SET.has(type) &&
    isName(from) &&
    isName(to)
  );
}

/**
 * ¿Es esto un `Graph` del contrato?
 *
 * Se pregunta al releer el grafo persistido: `ctx.storage` devuelve `undefined` la
 * primera vez y JSON sin tipar el resto de las veces. Aquí no se filtra nada —a
 * diferencia de `sanitizeProposal`— porque un grafo lo escribe el propio sistema: si no
 * cuadra entero, lo que hay no es un grafo a medias sino un grafo de otra versión o de
 * otro dueño, y adoptarlo a trozos daría un estado que nadie produjo nunca.
 *
 * Comprueba la forma, no los invariantes: que toda arista apunte a un nodo que existe lo
 * garantiza `mergeProposal`, no esta función.
 */
export function isGraph(value: unknown): value is Graph {
  if (!isRecord(value)) {
    return false;
  }
  const { nodes, edges, version } = value;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return false;
  }
  if (typeof version !== "number" || !Number.isFinite(version)) {
    return false;
  }
  return nodes.every(isNode) && edges.every(isEdge);
}
