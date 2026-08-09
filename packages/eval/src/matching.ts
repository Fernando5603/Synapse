import { normalizeName, type EntityType, type Graph } from "@synapse/graph-core";
import type { Gold, GoldEntity } from "./types";
import type { EntityMetrics, RelationMetrics } from "./types";

export interface EvalContext {
  gold: Gold;
  extracted: Graph;
  /** La lista de tipos permitidos: filtra gold y extracción, sin invalidar la métrica. */
  types: EntityType[];
}

export interface EntityMatchResult {
  withType: EntityMetrics;
  withoutType: EntityMetrics;
}

export interface RelationMatchResult {
  withType: RelationMetrics;
  withoutType: RelationMetrics;
}

/**
 * El matching de entidades.
 *
 * Una entidad acierta si su nombre normalizado coincide con el de una entidad gold o con
 * uno de sus alias anotados a mano **y** el tipo coincide. Cada gold se consume una sola
 * vez. Con y sin tipo: sin tipo separa un fallo de etiquetado de uno de comprensión.
 */
export function evalEntities(ctx: EvalContext): EntityMatchResult {
  const allowed = new Set(ctx.types);

  const goldEntities = ctx.gold.entities.filter((e) => allowed.has(e.type));
  const extractedNodes = ctx.extracted.nodes.filter((n) => allowed.has(n.type));

  return {
    withType: matchEntities(goldEntities, extractedNodes, true),
    withoutType: matchEntities(goldEntities, extractedNodes, false),
  };
}

function matchEntities(
  goldEntities: GoldEntity[],
  extractedNodes: Graph["nodes"],
  matchType: boolean,
): EntityMetrics {
  const goldKeys = goldEntities.map((e) => {
      const forms = [e.name, ...e.aliases].map(normalizeName);
    return { entity: e, forms };
  });

  const consumed = new Set<string>();
  let hits = 0;

  for (const node of extractedNodes) {
    const nodeKey = normalizeName(node.name);
    // Buscar el primer gold no consumido cuyo nombre o alias normalizado coincida,
    // y —si se exige— cuyo tipo coincida.
    const goldIndex = goldKeys.findIndex(({ entity, forms }) => {
      if (consumed.has(entity.id)) {
        return false;
      }
      if (matchType && entity.type !== node.type) {
        return false;
      }
      return forms.includes(nodeKey);
    });

    if (goldIndex === -1) {
      continue;
    }
    consumed.add(goldKeys[goldIndex]!.entity.id);
    hits += 1;
  }

  return {
    hits,
    goldSize: goldEntities.length,
    predictedSize: extractedNodes.length,
    precision: extractedNodes.length === 0 ? 0 : hits / extractedNodes.length,
    recall: goldEntities.length === 0 ? 0 : hits / goldEntities.length,
  };
}

/**
 * El matching de relaciones.
 *
 * Una relación acierta si sus dos extremos aciertan **y** el tipo de relación coincide.
 * Los extremos de la extracción vienen por nombre; se resuelven contra los ids gold usando
 * el mismo matching de entidades.
 */
export function evalRelations(ctx: EvalContext): RelationMatchResult {
  const allowed = new Set(ctx.types);

  // "Quitar un tipo" descarta las relaciones cuyos extremos son de tipos no permitidos:
  // sin el extremo, la relación no puede acertar. Eso filtra gold y extracción a la vez.
  const goldEntities = ctx.gold.entities.filter((e) => allowed.has(e.type));
  const goldEntityIds = new Set(goldEntities.map((e) => e.id));
  const goldRelations = ctx.gold.relations.filter(
    (r) => goldEntityIds.has(r.from) && goldEntityIds.has(r.to),
  );

  const extractedNodeIds = new Set(
    ctx.extracted.nodes.filter((n) => allowed.has(n.type)).map((n) => n.id),
  );
  const extractedEdges = ctx.extracted.edges.filter(
    (e) => extractedNodeIds.has(e.from) && extractedNodeIds.has(e.to),
  );

  return {
    withType: matchRelations(goldEntities, goldRelations, extractedEdges, ctx, true),
    withoutType: matchRelations(goldEntities, goldRelations, extractedEdges, ctx, false),
  };
}

function matchRelations(
  goldEntities: GoldEntity[],
  goldRelations: Gold["relations"],
  extractedEdges: Graph["edges"],
  ctx: EvalContext,
  matchType: boolean,
): RelationMetrics {
  // Resolver el nombre de un nodo extraído a un id gold (o null), con consumo único.
  function resolveNodeId(nodeName: string, nodeType: EntityType): string | null {
    const nodeKey = normalizeName(nodeName);
    const candidate = goldEntities.find((e) => {
    const forms = [e.name, ...e.aliases].map(normalizeName);
      if (!forms.includes(nodeKey)) {
        return false;
      }
      return !matchType || e.type === nodeType;
    });
    return candidate?.id ?? null;
  }

  const consumed = new Set<string>();
  let hits = 0;

  for (const edge of extractedEdges) {
    const fromNode = ctx.extracted.nodes.find((n) => n.id === edge.from);
    const toNode = ctx.extracted.nodes.find((n) => n.id === edge.to);
    if (fromNode === undefined || toNode === undefined) {
      continue;
    }
    const fromId = resolveNodeId(fromNode.name, fromNode.type);
    const toId = resolveNodeId(toNode.name, toNode.type);
    if (fromId === null || toId === null) {
      continue;
    }

    const goldIndex = goldRelations.findIndex((r) => {
      if (consumed.has(`${r.from}:${r.to}:${r.type}`)) {
        return false;
      }
      if (matchType && r.type !== edge.type) {
        return false;
      }
      return r.from === fromId && r.to === toId;
    });

    if (goldIndex === -1) {
      continue;
    }
    const matched = goldRelations[goldIndex]!;
    consumed.add(`${matched.from}:${matched.to}:${matched.type}`);
    hits += 1;
  }

  return {
    hits,
    goldSize: goldRelations.length,
    predictedSize: extractedEdges.length,
    precision: extractedEdges.length === 0 ? 0 : hits / extractedEdges.length,
  };
}
