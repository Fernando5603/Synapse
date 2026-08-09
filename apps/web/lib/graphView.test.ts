import { describe, expect, it } from "vitest";
import { emptyGraph, mergeProposal, type Graph } from "@synapse/graph-core";
import { NODE_RADIUS, degrees, neighborhood, nodeRadius } from "./graphView";

/** Un grafo en estrella: `latency` en el centro, con tres cosas colgando. */
function starGraph(): Graph {
  return mergeProposal(emptyGraph(), {
    nodes: [
      { type: "Concept", name: "latency" },
      { type: "Claim", name: "latency matters" },
      { type: "Question", name: "how fast is fast" },
      { type: "Concept", name: "cache" },
    ],
    edges: [
      { type: "ELABORATES", from: "latency matters", to: "latency" },
      { type: "ANSWERS", from: "how fast is fast", to: "latency" },
      { type: "SUPPORTS", from: "cache", to: "latency" },
    ],
  }).graph;
}

function idOf(graph: Graph, name: string): string {
  const node = graph.nodes.find((n) => n.name === name);
  if (node === undefined) {
    throw new Error(`No hay nodo "${name}" en el grafo de prueba.`);
  }
  return node.id;
}

describe("el grado de un nodo", () => {
  it("cuenta las relaciones que lo tocan, entren o salgan", () => {
    const graph = starGraph();

    expect(degrees(graph).get(idOf(graph, "latency"))).toBe(3);
    expect(degrees(graph).get(idOf(graph, "cache"))).toBe(1);
  });

  it("un nodo sin relaciones tiene grado cero, no queda fuera", () => {
    const graph = mergeProposal(emptyGraph(), {
      nodes: [{ type: "Concept", name: "solo" }],
      edges: [],
    }).graph;

    expect(degrees(graph).get(idOf(graph, "solo"))).toBe(0);
  });
});

describe("el tamaño de un nodo según sus relaciones", () => {
  it("un nodo suelto se pinta al tamaño mínimo", () => {
    expect(nodeRadius(0)).toBe(NODE_RADIUS.min);
  });

  it("más relaciones, nodo más grande", () => {
    expect(nodeRadius(6)).toBeGreaterThan(nodeRadius(1));
  });

  it("crece cada vez menos: el área es lo que compara el ojo", () => {
    const primerSalto = nodeRadius(1) - nodeRadius(0);
    const saltoTardío = nodeRadius(9) - nodeRadius(8);

    expect(saltoTardío).toBeLessThan(primerSalto);
  });

  it("tiene techo: el nodo más conectado no puede tapar el grafo", () => {
    expect(nodeRadius(500)).toBe(NODE_RADIUS.max);
  });
});

describe("el vecindario que se ilumina al posar el puntero", () => {
  it("incluye al nodo y a todo lo que está a un salto", () => {
    const graph = starGraph();

    const near = neighborhood(graph, idOf(graph, "latency"));

    expect(near).toEqual(
      new Set([
        idOf(graph, "latency"),
        idOf(graph, "latency matters"),
        idOf(graph, "how fast is fast"),
        idOf(graph, "cache"),
      ]),
    );
  });

  it("no llega a dos saltos: iluminar de más es no iluminar", () => {
    const graph = starGraph();

    const near = neighborhood(graph, idOf(graph, "cache"));

    expect(near).toEqual(new Set([idOf(graph, "cache"), idOf(graph, "latency")]));
  });
});
