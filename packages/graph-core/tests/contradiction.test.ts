import { describe, expect, it } from "vitest";
import type { Graph, Proposal } from "../src/index.js";
import { detectContradiction } from "../src/index.js";

function graph(nodes: Graph["nodes"], edges: Graph["edges"] = []): Graph {
  return { nodes, edges, version: edges.length };
}

/**
 * Bruno contradice el claim de Ana ("El modelo gratis no basta").
 * `from` contradice a `to`, igual que en el gold (e20 CONTRADICTS e18).
 */
function brunoContradictsAna(): Proposal {
  return {
    nodes: [{ type: "Claim", name: "El modelo gratis basta", proposedBy: "u_bruno" }],
    edges: [
      { type: "CONTRADICTS", from: "El modelo gratis basta", to: "El modelo gratis no basta" },
    ],
  };
}

describe("la detección de contradicción", () => {
  it("devuelve el autor del Claim contradicho cuando la propuesta lo contradice", () => {
    const g = graph([
      { id: "claim-modelo-gratis-no-basta", type: "Claim", name: "El modelo gratis no basta", proposedBy: "u_ana" },
    ]);

    const result = detectContradiction(g, brunoContradictsAna(), "u_bruno");

    expect(result).toEqual({
      targetUserId: "u_ana",
      claimId: "claim-modelo-gratis-no-basta",
    });
  });

  it("devuelve nulo cuando el autor de la propuesta es el mismo que el del Claim", () => {
    const g = graph([
      { id: "claim-modelo-gratis-no-basta", type: "Claim", name: "El modelo gratis no basta", proposedBy: "u_bruno" },
    ]);

    const result = detectContradiction(g, brunoContradictsAna(), "u_bruno");

    expect(result).toBeNull();
  });

  it("devuelve nulo cuando no hay contradicción en la propuesta", () => {
    const g = graph([
      { id: "claim-modelo-gratis-no-basta", type: "Claim", name: "El modelo gratis no basta", proposedBy: "u_ana" },
    ]);

    const result = detectContradiction(g, { nodes: [], edges: [] }, "u_bruno");

    expect(result).toBeNull();
  });

  it("devuelve nulo cuando el Claim contradicho no existe aún en el grafo", () => {
    const g = graph([]);

    const result = detectContradiction(g, brunoContradictsAna(), "u_bruno");

    expect(result).toBeNull();
  });

  it("devuelve nulo cuando el Claim contradicho no tiene autor conocido", () => {
    const g = graph([
      { id: "claim-modelo-gratis-no-basta", type: "Claim", name: "El modelo gratis no basta" },
    ]);

    const result = detectContradiction(g, brunoContradictsAna(), "u_bruno");

    expect(result).toBeNull();
  });
});
