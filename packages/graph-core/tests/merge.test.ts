import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyGraph, mergeProposal } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "../src");

describe("la fusión de propuestas al grafo", () => {
  it("una propuesta sobre un grafo vacío produce los nodos, las aristas y el delta correspondientes", () => {
    const result = mergeProposal(emptyGraph(), {
      nodes: [
        { type: "Concept", name: "Base de datos" },
        { type: "Claim", name: "SQL es relacional" },
      ],
      edges: [
        { type: "SUPPORTS", from: "Base de datos", to: "SQL es relacional" },
      ],
    });

    expect(result.graph.nodes).toHaveLength(2);
    expect(result.graph.edges).toHaveLength(1);
    expect(result.delta.addedNodes).toHaveLength(2);
    expect(result.delta.addedEdges).toHaveLength(1);
    expect(result.graph.version).toBe(1);
    expect(result.delta.version).toBe(1);
  });

  it("no muta el grafo de entrada", () => {
    const graph = {
      nodes: [{ id: "n1", type: "Concept" as const, name: "Existing" }],
      edges: [],
      version: 3,
    };
    const snapshot = JSON.parse(JSON.stringify(graph));

    mergeProposal(graph, {
      nodes: [{ type: "Claim", name: "Nueva idea" }],
      edges: [],
    });

    expect(graph).toEqual(snapshot);
  });

  it("dos propuestas del mismo concepto con distinta grafía —mayúsculas— dan un solo nodo", () => {
    const proposalA = {
      nodes: [{ type: "Concept", name: "Base de datos" }],
      edges: [],
    };
    const proposalB = {
      nodes: [{ type: "Concept", name: "BASE DE DATOS" }],
      edges: [],
    };

    const afterA = mergeProposal(emptyGraph(), proposalA);
    const afterB = mergeProposal(afterA.graph, proposalB);

    expect(afterA.graph.nodes).toHaveLength(1);
    expect(afterB.graph.nodes).toHaveLength(1);
    expect(afterB.delta.addedNodes).toHaveLength(0);
    expect(afterB.graph.nodes[0]!.name).toBe("Base de datos");
  });

  it("tres grafías del mismo concepto —plural, tilde y artículo— dan un solo nodo", () => {
    const singular = {
      nodes: [{ type: "Concept", name: "decisión" }],
      edges: [],
    };
    const plural = {
      nodes: [{ type: "Concept", name: "decisiones" }],
      edges: [],
    };
    const conArticulo = {
      nodes: [{ type: "Concept", name: "la decisión" }],
      edges: [],
    };

    const afterSingular = mergeProposal(emptyGraph(), singular);
    const afterPlural = mergeProposal(afterSingular.graph, plural);
    const afterArticulo = mergeProposal(afterPlural.graph, conArticulo);

    expect(afterArticulo.graph.nodes).toHaveLength(1);
    expect(afterPlural.delta.addedNodes).toHaveLength(0);
    expect(afterArticulo.delta.addedNodes).toHaveLength(0);
  });

  it("reaplicar una propuesta ya mergeada no añade nada", () => {
    const proposal = {
      nodes: [{ type: "Claim", name: "El césped es verde" }],
      edges: [],
    };

    const first = mergeProposal(emptyGraph(), proposal);
    const second = mergeProposal(first.graph, proposal);

    expect(second.graph.nodes).toHaveLength(1);
    expect(second.delta.addedNodes).toHaveLength(0);
    expect(second.delta.addedEdges).toHaveLength(0);
  });

  it("una propuesta sin novedad produce un delta vacío con la versión incrementada", () => {
    const graph = {
      nodes: [{ id: "n1", type: "Concept" as const, name: "Existing" }],
      edges: [],
      version: 5,
    };

    const result = mergeProposal(graph, {
      nodes: [{ type: "Concept", name: "Existing" }],
      edges: [],
    });

    expect(result.delta.addedNodes).toHaveLength(0);
    expect(result.delta.addedEdges).toHaveLength(0);
    expect(result.delta.version).toBe(6);
    expect(result.graph.version).toBe(6);
  });

  it("la versión crece de forma monótona y el delta siempre la reporta", () => {
    const first = mergeProposal(emptyGraph(), {
      nodes: [{ type: "Concept", name: "A" }],
      edges: [],
    });
    const second = mergeProposal(first.graph, {
      nodes: [{ type: "Concept", name: "B" }],
      edges: [],
    });
    const third = mergeProposal(second.graph, {
      nodes: [{ type: "Concept", name: "A" }],
      edges: [],
    });

    expect(first.delta.version).toBe(1);
    expect(second.delta.version).toBe(2);
    expect(third.delta.version).toBe(3);
    expect(second.graph.version).toBe(first.graph.version + 1);
    expect(third.graph.version).toBe(second.graph.version + 1);
    expect(third.delta.version).toBe(third.graph.version);
  });

  it("una arista que se refiere a los extremos por nombre se resuelve contra los nodos existentes y no los duplica", () => {
    const graph = {
      nodes: [
        { id: "n1", type: "Claim" as const, name: "SQL es relacional" },
        { id: "n2", type: "Concept" as const, name: "Base de datos" },
      ],
      edges: [],
      version: 2,
    };

    const result = mergeProposal(graph, {
      nodes: [],
      edges: [
        { type: "SUPPORTS", from: "base de datos", to: "SQL es relacional" },
      ],
    });

    expect(result.graph.nodes).toHaveLength(2);
    expect(result.graph.edges).toHaveLength(1);
    expect(result.delta.addedNodes).toHaveLength(0);
    expect(result.delta.addedEdges[0]!.from).toBe("n2");
    expect(result.delta.addedEdges[0]!.to).toBe("n1");
  });

  it("una arista hacia un nombre que no existe se descarta en vez de inventar un nodo", () => {
    const graph = {
      nodes: [{ id: "n1", type: "Claim" as const, name: "SQL es relacional" }],
      edges: [],
      version: 1,
    };

    const result = mergeProposal(graph, {
      nodes: [],
      edges: [{ type: "SUPPORTS", from: "nadie propuso esto", to: "SQL es relacional" }],
    });

    expect(result.graph.edges).toHaveLength(0);
    expect(result.delta.addedEdges).toHaveLength(0);
  });

  it("si dos nodos de distinto tipo comparten nombre, una arista por nombre resuelve al primero registrado", () => {
    const graph = {
      nodes: [
        { id: "concept-python", type: "Concept" as const, name: "Python" },
        { id: "person-python", type: "Person" as const, name: "Python" },
      ],
      edges: [],
      version: 1,
    };

    const result = mergeProposal(graph, {
      nodes: [],
      edges: [{ type: "ELABORATES", from: "python", to: "python" }],
    });

    expect(result.graph.edges).toHaveLength(1);
    expect(result.delta.addedEdges[0]!.from).toBe("concept-python");
    expect(result.delta.addedEdges[0]!.to).toBe("concept-python");
  });
});

describe("el módulo es puro", () => {
  it("no importa nada de Portal, Next.js, fetch ni Date", () => {
    const source = ["index.ts", "merge.ts", "types.ts"]
      .map((file) => readFileSync(resolve(srcDir, file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/@portalsdk/);
    expect(source).not.toMatch(/next\/|react/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/new\s+Date\b/);
  });
});
