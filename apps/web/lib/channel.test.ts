import { describe, expect, it } from "vitest";
import { emptyGraph, mergeProposal, type Graph } from "@synapse/graph-core";
import { graphWithSnapshot } from "./channel";

/** El grafo que la extensión tendría a mitad de sesión, con su versión. */
function sessionGraph(): Graph {
  const first = mergeProposal(emptyGraph(), {
    nodes: [
      { type: "Concept", name: "latency" },
      { type: "Claim", name: "latency matters more than perfection" },
    ],
    edges: [
      { type: "ELABORATES", from: "latency matters more than perfection", to: "latency" },
    ],
  });
  return mergeProposal(first.graph, {
    nodes: [{ type: "Question", name: "can we swap the provider" }],
    edges: [],
  }).graph;
}

/** La trama de conexión tal como la entrega el SDK: los blobs van por handle. */
function connectFrame(snapshot: unknown): Record<string, unknown> {
  return { graph: snapshot };
}

describe("el grafo que ve quien entra a mitad de sesión", () => {
  it("pinta el grafo entero que sirve la extensión, no lo que le quede por pasar", () => {
    const authoritative = sessionGraph();

    const graph = graphWithSnapshot(
      emptyGraph(),
      connectFrame({ graph: authoritative, instance: { epoch: 1, rehydrated: true, batches: 0 } }),
    );

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(1);
    expect(graph.version).toBe(authoritative.version);
  });

  // El snapshot es de la trama de conexión: un delta puede haber llegado y pintado antes
  // de que nadie lo lea. Adoptarlo a secas devolvería la pantalla a un pasado.
  it("adoptar el snapshot no borra un delta que ya se había pintado", () => {
    const authoritative = sessionGraph();
    const local: Graph = {
      nodes: [{ id: "decision-usar-portal", type: "Decision", name: "usar Portal" }],
      edges: [],
      version: authoritative.version + 1,
    };

    const graph = graphWithSnapshot(local, connectFrame({ graph: authoritative }));

    expect(graph.nodes).toHaveLength(4);
    expect(graph.nodes.map((node) => node.id)).toContain("decision-usar-portal");
    expect(graph.version).toBe(authoritative.version + 1);
  });

  it("releer el mismo snapshot —una reconexión— no duplica nada", () => {
    const frame = connectFrame({ graph: sessionGraph() });

    const once = graphWithSnapshot(emptyGraph(), frame);
    const twice = graphWithSnapshot(once, frame);

    expect(twice).toEqual(once);
  });

  it("mientras no hay trama de conexión se sigue con lo que hay", () => {
    const local = sessionGraph();

    expect(graphWithSnapshot(local, undefined)).toBe(local);
  });

  // Una extensión degradada es clave ausente, no clave nula: no hay grafo que servir, y
  // vaciar la pantalla sería peor que dejarla como está.
  it("una extensión que no contestó deja intacto lo que ya se veía", () => {
    const local = sessionGraph();

    expect(graphWithSnapshot(local, {})).toBe(local);
    expect(graphWithSnapshot(local, { otra: { cosa: 1 } })).toBe(local);
  });

  it("un snapshot que no cumple el contrato se ignora en vez de pintarse", () => {
    const local = sessionGraph();

    for (const blob of [
      "basura",
      null,
      {},
      { graph: "basura" },
      { graph: { nodes: [], edges: [] } },
      { graph: { nodes: [{ id: "x", type: "Banana", name: "algo" }], edges: [], version: 1 } },
    ]) {
      expect(graphWithSnapshot(local, connectFrame(blob))).toBe(local);
    }
  });
});
