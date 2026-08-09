import type { EntityType, Graph, RelationType } from "@synapse/graph-core";

/** El gold anotado (gold/gold.json). */
export interface GoldEntity {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  firstTurn: number;
}

export interface GoldRelation {
  type: RelationType;
  from: string;
  to: string;
  turn: number;
}

export interface Gold {
  schemaVersion: number;
  language: string;
  entityTypes: EntityType[];
  relationTypes: RelationType[];
  turns: { n: number; speaker: string; text: string }[];
  entities: GoldEntity[];
  relations: GoldRelation[];
}

/**
 * El resultado del matching. `goldSize`/`predictedSize` son los totales después de
 * filtrar por la lista de tipos permitidos; `hits` los aciertos. Con y sin tipo.
 */
export interface EntityMetrics {
  hits: number;
  goldSize: number;
  predictedSize: number;
  precision: number;
  recall: number;
}

export interface RelationMetrics {
  hits: number;
  goldSize: number;
  predictedSize: number;
  precision: number;
}

export interface EvalReport {
  entities: { withType: EntityMetrics; withoutType: EntityMetrics };
  relations: { withType: RelationMetrics; withoutType: RelationMetrics };
}
