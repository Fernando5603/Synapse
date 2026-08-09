import { describe, expect, it } from "vitest";
import { isGraph, mergeProposal, sanitizeProposal } from "../src/index.js";

describe("la lectura de una propuesta que llega de fuera", () => {
  it("una propuesta bien formada se conserva entera", () => {
    const proposal = sanitizeProposal({
      nodes: [
        { type: "Concept", name: "Base de datos" },
        { type: "Claim", name: "SQL es relacional", proposedBy: "u-ana" },
      ],
      edges: [{ type: "SUPPORTS", from: "SQL es relacional", to: "Base de datos" }],
    });

    expect(proposal.nodes).toHaveLength(2);
    expect(proposal.nodes[1]!.proposedBy).toBe("u-ana");
    expect(proposal.edges).toHaveLength(1);
  });

  it("un nodo con un tipo que no está en el esquema se descarta y el resto sobrevive", () => {
    const proposal = sanitizeProposal({
      nodes: [
        { type: "Banana", name: "algo" },
        { type: "Concept", name: "Portal" },
      ],
      edges: [],
    });

    expect(proposal.nodes).toHaveLength(1);
    expect(proposal.nodes[0]!.name).toBe("Portal");
  });

  it("una arista con un tipo de relación desconocido se descarta", () => {
    const proposal = sanitizeProposal({
      nodes: [],
      edges: [
        { type: "MENTIONS", from: "a", to: "b" },
        { type: "ANSWERS", from: "a", to: "b" },
      ],
    });

    expect(proposal.edges).toHaveLength(1);
    expect(proposal.edges[0]!.type).toBe("ANSWERS");
  });

  it("un nodo sin nombre legible no entra al grafo", () => {
    const proposal = sanitizeProposal({
      nodes: [
        { type: "Concept", name: "" },
        { type: "Concept", name: "   " },
        { type: "Concept", name: 42 },
        { type: "Concept" },
      ],
      edges: [],
    });

    expect(proposal.nodes).toHaveLength(0);
  });

  it("un campo que no está en el contrato no llega al grafo", () => {
    const proposal = sanitizeProposal({
      nodes: [{ type: "Concept", name: "Portal", confidence: 0.4, id: "inventado" }],
      edges: [{ type: "SUPPORTS", from: "a", to: "b", weight: 3 }],
    });

    expect(Object.keys(proposal.nodes[0]!).sort()).toEqual(["name", "type"]);
    expect(Object.keys(proposal.edges[0]!).sort()).toEqual(["from", "to", "type"]);
  });

  it("un `proposedBy` que no es una cadena se ignora en vez de viajar al nodo", () => {
    const proposal = sanitizeProposal({
      nodes: [{ type: "Claim", name: "algo", proposedBy: { id: "u-ana" } }],
      edges: [],
    });

    expect(proposal.nodes[0]!.proposedBy).toBeUndefined();
  });

  it("lo que no tiene forma de propuesta se lee como una propuesta vacía", () => {
    for (const value of [undefined, null, "texto", 7, [], {}, { nodes: "no" }]) {
      const proposal = sanitizeProposal(value);
      expect(proposal.nodes).toEqual([]);
      expect(proposal.edges).toEqual([]);
    }
  });

  it("una propuesta ilegible mergeada deja el grafo igual y avanza la versión", () => {
    const before = mergeProposal(
      { nodes: [], edges: [], version: 0 },
      sanitizeProposal({ nodes: [{ type: "Concept", name: "Portal" }], edges: [] }),
    );

    const after = mergeProposal(before.graph, sanitizeProposal("basura"));

    expect(after.graph.nodes).toHaveLength(1);
    expect(after.delta.addedNodes).toHaveLength(0);
    expect(after.delta.version).toBe(before.graph.version + 1);
  });
});

describe("la lectura del grafo persistido", () => {
  it("el grafo que produjo un merge se relee tal cual", () => {
    const { graph } = mergeProposal(
      { nodes: [], edges: [], version: 0 },
      {
        nodes: [
          { type: "Concept", name: "Portal" },
          { type: "Claim", name: "Portal sincroniza" },
        ],
        edges: [{ type: "ELABORATES", from: "Portal sincroniza", to: "Portal" }],
      },
    );

    // Ida y vuelta por JSON: es lo que hace `ctx.storage` con lo que se le guarda.
    expect(isGraph(JSON.parse(JSON.stringify(graph)))).toBe(true);
  });

  it("un grafo vacío es un grafo", () => {
    expect(isGraph({ nodes: [], edges: [], version: 0 })).toBe(true);
  });

  it("lo que no tiene forma de grafo no se reconoce", () => {
    // `undefined` es lo que devuelve el almacenamiento la primera vez: no es un fallo,
    // pero tampoco un grafo, y quien pregunta tiene que empezar de cero.
    for (const value of [
      undefined,
      null,
      "texto",
      [],
      {},
      { nodes: [], edges: [] },
      { nodes: [], edges: [], version: "1" },
      { nodes: {}, edges: [], version: 1 },
    ]) {
      expect(isGraph(value)).toBe(false);
    }
  });

  it("un grafo con un solo nodo corrupto no se reconoce", () => {
    expect(
      isGraph({
        nodes: [
          { id: "concept-portal", type: "Concept", name: "Portal" },
          { id: "x", type: "Banana", name: "algo" },
        ],
        edges: [],
        version: 2,
      }),
    ).toBe(false);
  });

  it("un grafo con una arista sin extremos no se reconoce", () => {
    expect(
      isGraph({
        nodes: [],
        edges: [{ id: "e1", type: "SUPPORTS", from: "a" }],
        version: 1,
      }),
    ).toBe(false);
  });
});
