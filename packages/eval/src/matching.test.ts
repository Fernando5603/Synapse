import { describe, expect, it } from "vitest";
import type { EntityType, Graph } from "@synapse/graph-core";
import { evalEntities, evalRelations, type EvalContext } from "./matching";
import type { Gold, GoldEntity } from "./types";

function goldEntity(id: string, type: EntityType, name: string, aliases: string[] = []): GoldEntity {
  return { id, type, name, aliases, firstTurn: 1 };
}

function gold(entities: GoldEntity[]): Gold {
  return {
    schemaVersion: 1,
    language: "en",
    entityTypes: ["Claim", "Concept", "Question", "Evidence", "Person", "Decision"],
    relationTypes: ["SUPPORTS", "CONTRADICTS", "ELABORATES", "ANSWERS", "PROPOSED_BY", "RESOLVES"],
    turns: [],
    entities,
    relations: [],
  };
}

function graph(nodes: Graph["nodes"], edges: Graph["edges"] = []): Graph {
  return { nodes, edges, version: 0 };
}

function ctx(overrides: Partial<EvalContext> = {}): EvalContext {
  return {
    gold: gold([goldEntity("e1", "Concept", "Base de datos", ["bases de datos"])]),
    extracted: graph([
      { id: "n1", type: "Concept", name: "Base de datos" },
    ]),
    types: ["Claim", "Concept", "Question", "Evidence", "Person", "Decision"],
    ...overrides,
  };
}

describe("el matching de entidades", () => {
  it("acierta cuando el nombre normalizado y el tipo coinciden", () => {
    const result = evalEntities(ctx());

    expect(result.withType.hits).toBe(1);
    expect(result.withType.precision).toBe(1);
    expect(result.withType.recall).toBe(1);
  });

  it("acepta un alias anotado a mano como acierto", () => {
    const result = evalEntities(
      ctx({
        extracted: graph([{ id: "n1", type: "Concept", name: "bases de datos" }]),
      }),
    );

    expect(result.withType.hits).toBe(1);
  });

  it("no acierta si el tipo difiere aunque el nombre coincida", () => {
    const result = evalEntities(
      ctx({
        extracted: graph([{ id: "n1", type: "Claim", name: "Base de datos" }]),
      }),
    );

    expect(result.withType.hits).toBe(0);
  });

  it("no acierta si el nombre no coincide", () => {
    const result = evalEntities(
      ctx({
        extracted: graph([{ id: "n1", type: "Concept", name: "Otra cosa" }]),
      }),
    );

    expect(result.withType.hits).toBe(0);
  });

  it("cada entidad gold se consume una sola vez: dos extracciones del mismo gold no dan dos aciertos", () => {
    const result = evalEntities(
      ctx({
        extracted: graph([
          { id: "n1", type: "Concept", name: "Base de datos" },
          { id: "n2", type: "Concept", name: "base de datos" },
        ]),
      }),
    );

    expect(result.withType.hits).toBe(1);
  });

  it("la métrica sin tipo separa un fallo de etiquetado de uno de comprensión", () => {
    const result = evalEntities(
      ctx({
        extracted: graph([{ id: "n1", type: "Claim", name: "Base de datos" }]),
      }),
    );

    // Sin tipo acierta (el nombre coincide); con tipo no (el tipo difiere).
    expect(result.withoutType.hits).toBe(1);
    expect(result.withType.hits).toBe(0);
  });

  it("quitar un tipo del esquema filtra gold y extracción sin invalidar la métrica", () => {
    const result = evalEntities(
      ctx({
        gold: gold([
          goldEntity("e1", "Concept", "Base de datos"),
          goldEntity("e2", "Claim", "SQL es relacional"),
        ]),
        extracted: graph([
          { id: "n1", type: "Concept", name: "Base de datos" },
          { id: "n2", type: "Claim", name: "SQL es relacional" },
        ]),
        types: ["Claim", "Concept"], // sin Question, Evidence, Person, Decision
      }),
    );

    expect(result.withType.hits).toBe(2);
    expect(result.withType.goldSize).toBe(2);
    expect(result.withType.predictedSize).toBe(2);
  });
});

describe("el matching de relaciones", () => {
  it("acierta si sus dos extremos aciertan y el tipo coincide", () => {
    const g = gold([
      goldEntity("e1", "Claim", "SQL es relacional"),
      goldEntity("e2", "Concept", "Base de datos"),
    ]);
    const result = evalRelations(
      {
        gold: { ...g, relations: [{ type: "SUPPORTS", from: "e1", to: "e2", turn: 1 }] },
        extracted: graph(
          [
            { id: "n1", type: "Claim", name: "SQL es relacional" },
            { id: "n2", type: "Concept", name: "Base de datos" },
          ],
          [{ id: "e1", type: "SUPPORTS", from: "n1", to: "n2" }],
        ),
        types: ["Claim", "Concept", "Question", "Evidence", "Person", "Decision"],
      },
    );

    expect(result.withType.hits).toBe(1);
    expect(result.withType.precision).toBe(1);
  });

  it("no acierta si un extremo no acierta", () => {
    const g = gold([
      goldEntity("e1", "Claim", "SQL es relacional"),
      goldEntity("e2", "Concept", "Base de datos"),
    ]);
    const result = evalRelations(
      {
        gold: { ...g, relations: [{ type: "SUPPORTS", from: "e1", to: "e2", turn: 1 }] },
        extracted: graph(
          [
            { id: "n1", type: "Claim", name: "SQL es relacional" },
            { id: "n2", type: "Concept", name: "Otra cosa" },
          ],
          [{ id: "e1", type: "SUPPORTS", from: "n1", to: "n2" }],
        ),
        types: ["Claim", "Concept", "Question", "Evidence", "Person", "Decision"],
      },
    );

    expect(result.withType.hits).toBe(0);
  });

  it("no acierta si el tipo de relación difiere", () => {
    const g = gold([
      goldEntity("e1", "Claim", "SQL es relacional"),
      goldEntity("e2", "Concept", "Base de datos"),
    ]);
    const result = evalRelations(
      {
        gold: { ...g, relations: [{ type: "SUPPORTS", from: "e1", to: "e2", turn: 1 }] },
        extracted: graph(
          [
            { id: "n1", type: "Claim", name: "SQL es relacional" },
            { id: "n2", type: "Concept", name: "Base de datos" },
          ],
          [{ id: "e1", type: "CONTRADICTS", from: "n1", to: "n2" }],
        ),
        types: ["Claim", "Concept", "Question", "Evidence", "Person", "Decision"],
      },
    );

    expect(result.withType.hits).toBe(0);
  });
});