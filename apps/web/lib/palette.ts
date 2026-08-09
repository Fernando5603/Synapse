import type { EntityType, RelationType } from "@synapse/graph-core";

/**
 * Los colores del grafo.
 *
 * Viven en TypeScript y no en variables CSS porque el consumidor principal es SVG
 * generado desde JS —el `fill` de un nodo, el gradiente de una arista, el halo de un
 * cursor— y una variable CSS ahí obliga a leer el estilo computado en cada fotograma.
 * La leyenda los usa en línea, así que hay un solo sitio donde cambiarlos.
 *
 * Cada tipo lleva el color pleno y una versión suave para el halo, porque los dos se
 * pintan siempre juntos y derivarlos con opacidad daría un halo que se ensucia al
 * solaparse con otro nodo.
 */
export interface EntityPaint {
  /** El relleno del disco. */
  fill: string;
  /** El halo exterior, ya con la transparencia dentro. */
  glow: string;
  /** La inicial que va dentro del disco. */
  initial: string;
  /** El nombre que ve el usuario en la leyenda. */
  label: string;
}

export const ENTITY_PAINT: Record<EntityType, EntityPaint> = {
  Claim: {
    fill: "#8b7cf8",
    glow: "rgba(139, 124, 248, 0.28)",
    initial: "A",
    label: "Afirmación",
  },
  Concept: {
    fill: "#2dd4bf",
    glow: "rgba(45, 212, 191, 0.28)",
    initial: "C",
    label: "Concepto",
  },
  Question: {
    fill: "#fbbf24",
    glow: "rgba(251, 191, 36, 0.28)",
    initial: "?",
    label: "Pregunta",
  },
  Evidence: {
    fill: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.28)",
    initial: "E",
    label: "Evidencia",
  },
  Person: {
    fill: "#f472b6",
    glow: "rgba(244, 114, 182, 0.28)",
    initial: "P",
    label: "Persona",
  },
  Decision: {
    fill: "#4ade80",
    glow: "rgba(74, 222, 128, 0.28)",
    initial: "D",
    label: "Decisión",
  },
};

/**
 * El color de cada relación. `SUPPORTS` verde y `CONTRADICTS` rojo son contrato de
 * producto (spec): son las dos que se leen de un vistazo desde el fondo de la sala. El
 * resto es estructura y se pinta apagado para no competir con ellas.
 */
export const RELATION_PAINT: Record<RelationType, { stroke: string; dashed: boolean }> = {
  SUPPORTS: { stroke: "#4ade80", dashed: false },
  CONTRADICTS: { stroke: "#f87171", dashed: false },
  ELABORATES: { stroke: "#7c86a8", dashed: false },
  ANSWERS: { stroke: "#7c86a8", dashed: true },
  PROPOSED_BY: { stroke: "#5b6480", dashed: true },
  RESOLVES: { stroke: "#7c86a8", dashed: true },
};

/**
 * Los colores con los que se distingue a cada participante (cursor, avatar, punto del
 * roster). Se elige por hash del id, así que la misma persona es del mismo color en las
 * tres pantallas sin que nadie coordine nada.
 */
const PARTICIPANT_COLORS = [
  "#8b7cf8",
  "#2dd4bf",
  "#fbbf24",
  "#f472b6",
  "#38bdf8",
  "#4ade80",
  "#fb923c",
  "#c084fc",
];

export function participantColor(userId: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i += 1) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return PARTICIPANT_COLORS[(hash >>> 0) % PARTICIPANT_COLORS.length]!;
}
