import { describe, expect, it } from "vitest";
import { applyDelta, emptyGraph, mergeProposal } from "../src/index.js";

describe("la aplicación de un delta sobre el grafo de un cliente", () => {
  it("un delta sobre un grafo vacío deja el grafo que el delta anuncia", () => {
    const graph = applyDelta(emptyGraph(), {
      addedNodes: [{ id: "concept-latency", type: "Concept", name: "latency" }],
      addedEdges: [],
      version: 1,
    });

    expect(graph.nodes).toEqual([
      { id: "concept-latency", type: "Concept", name: "latency" },
    ]);
    expect(graph.version).toBe(1);
  });

  it("aplicar dos deltas seguidos acumula lo que traen los dos", () => {
    const first = applyDelta(emptyGraph(), {
      addedNodes: [{ id: "concept-latency", type: "Concept", name: "latency" }],
      addedEdges: [],
      version: 1,
    });
    const second = applyDelta(first, {
      addedNodes: [{ id: "claim-latency-matter", type: "Claim", name: "latency matters" }],
      addedEdges: [
        {
          id: "supports-claim-latency-matter-concept-latency",
          type: "SUPPORTS",
          from: "claim-latency-matter",
          to: "concept-latency",
        },
      ],
      version: 2,
    });

    expect(second.nodes.map((node) => node.id)).toEqual([
      "concept-latency",
      "claim-latency-matter",
    ]);
    expect(second.edges).toHaveLength(1);
    expect(second.version).toBe(2);
  });

  // Los batches de una extensión llegan al menos una vez: tras un fallo de red Portal
  // puede reentregar uno ya procesado. Reaplicar un delta no puede duplicar nada.
  it("reaplicar el mismo delta no duplica nodos ni aristas", () => {
    const delta = {
      addedNodes: [{ id: "concept-latency", type: "Concept" as const, name: "latency" }],
      addedEdges: [],
      version: 1,
    };

    const once = applyDelta(emptyGraph(), delta);
    const twice = applyDelta(once, delta);

    expect(twice.nodes).toHaveLength(1);
    expect(twice.edges).toHaveLength(0);
    expect(twice.version).toBe(1);
  });

  it("un delta vacío deja el contenido intacto y sube la versión", () => {
    const before = applyDelta(emptyGraph(), {
      addedNodes: [{ id: "concept-latency", type: "Concept", name: "latency" }],
      addedEdges: [],
      version: 1,
    });

    const after = applyDelta(before, { addedNodes: [], addedEdges: [], version: 2 });

    expect(after.nodes).toEqual(before.nodes);
    expect(after.edges).toEqual(before.edges);
    expect(after.version).toBe(2);
  });

  // La versión es lo que el badge de la sala muestra como "estoy al día". Un delta
  // reentregado tarde no puede hacerla retroceder y mentir sobre el estado.
  it("un delta atrasado no hace retroceder la versión", () => {
    const current = applyDelta(emptyGraph(), {
      addedNodes: [],
      addedEdges: [],
      version: 7,
    });

    const after = applyDelta(current, {
      addedNodes: [{ id: "concept-latency", type: "Concept", name: "latency" }],
      addedEdges: [],
      version: 3,
    });

    expect(after.version).toBe(7);
    expect(after.nodes).toHaveLength(1);
  });

  it("no muta el grafo de entrada", () => {
    const graph = emptyGraph();
    const snapshot = JSON.parse(JSON.stringify(graph));

    applyDelta(graph, {
      addedNodes: [{ id: "concept-latency", type: "Concept", name: "latency" }],
      addedEdges: [],
      version: 1,
    });

    expect(graph).toEqual(snapshot);
  });

  // El cliente y la extensión tienen que converger: aplicar los deltas que produce
  // `mergeProposal` sobre un grafo vacío da el mismo grafo que la extensión tiene.
  it("aplicar los deltas de una sesión reconstruye el grafo de la extensión", () => {
    const first = mergeProposal(emptyGraph(), {
      nodes: [
        { type: "Concept", name: "latency" },
        { type: "Claim", name: "latency matters" },
      ],
      edges: [{ type: "SUPPORTS", from: "latency matters", to: "latency" }],
    });
    const second = mergeProposal(first.graph, {
      nodes: [{ type: "Question", name: "can we swap the provider" }],
      edges: [{ type: "ANSWERS", from: "can we swap the provider", to: "latency" }],
    });

    const mirrored = applyDelta(applyDelta(emptyGraph(), first.delta), second.delta);

    expect(mirrored).toEqual(second.graph);
  });
});
