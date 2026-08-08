import { describe, expect, it } from "vitest";
import type { Graph } from "@synapse/graph-core";
import { relaxNeighbors, seedPosition } from "./layout";
import { mockSessionGraph } from "./mockGraph";

const BOUNDS = { width: 840, height: 600 };

function graph(nodes: string[], edges: [string, string][] = []): Graph {
  return {
    version: 0,
    nodes: nodes.map((id) => ({ id, type: "Concept", name: id })),
    edges: edges.map(([from, to], i) => ({
      id: `e${i}`,
      type: "SUPPORTS",
      from,
      to,
    })),
  };
}

describe("la siembra de posición de un nodo", () => {
  it("no depende del orden en que llegó el nodo", () => {
    const a = seedPosition("nodo-1", BOUNDS);
    const b = seedPosition("nodo-2", BOUNDS);
    const c = seedPosition("nodo-3", BOUNDS);

    expect(seedPosition("nodo-1", BOUNDS)).toEqual(a);
    expect(seedPosition("nodo-2", BOUNDS)).toEqual(b);
    expect(seedPosition("nodo-3", BOUNDS)).toEqual(c);
  });

  it("el mismo nodo siempre siembra en el mismo sitio", () => {
    expect(seedPosition("claim-sql-es-relacional", BOUNDS)).toEqual(
      seedPosition("claim-sql-es-relacional", BOUNDS),
    );
  });

  it("cae siempre dentro de los límites del lienzo", () => {
    for (let i = 0; i < 50; i++) {
      const { x, y } = seedPosition(`nodo-${i}`, BOUNDS);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(BOUNDS.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(BOUNDS.height);
    }
  });

  it("en el grafo de una sesión real (~40 nodos) ninguna posición colisiona", () => {
    const positions = mockSessionGraph().nodes.map((node) =>
      seedPosition(node.id, BOUNDS),
    );
    const keys = new Set(positions.map((p) => `${p.x},${p.y}`));
    expect(keys.size).toBe(positions.length);
  });
});

describe("la relajación local contra vecinos", () => {
  it("mueve solo a los vecinos inmediatos del nodo ancla", () => {
    const g = graph(["a", "b", "c", "d"], [["a", "b"], ["a", "c"]]);
    const positions = new Map([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 20, y: 0 }],
      ["c", { x: 20, y: 20 }],
      ["d", { x: 500, y: 500 }],
    ]);

    const relaxed = relaxNeighbors(g, positions, "a", { desiredDistance: 200 });

    expect(relaxed.get("a")).toEqual({ x: 0, y: 0 });
    expect(relaxed.get("d")).toEqual({ x: 500, y: 500 });
    expect(relaxed.get("b")).not.toEqual({ x: 20, y: 0 });
    expect(relaxed.get("c")).not.toEqual({ x: 20, y: 20 });
  });

  it("separa un vecino pegado hacia la distancia de reposo", () => {
    const g = graph(["a", "b"], [["a", "b"]]);
    const positions = new Map([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 20, y: 0 }],
    ]);

    const relaxed = relaxNeighbors(g, positions, "a", { desiredDistance: 200 });

    const a = relaxed.get("a")!;
    const b = relaxed.get("b")!;
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    expect(distance).toBeGreaterThan(20);
    expect(distance).toBeLessThanOrEqual(200);
  });

  it("cada paso mueve al vecino la mitad de la corrección, no de golpe", () => {
    const g = graph(["a", "b"], [["a", "b"]]);
    const positions = new Map([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 20, y: 0 }],
    ]);

    const relaxed = relaxNeighbors(g, positions, "a", { desiredDistance: 200 });

    // Corrección total (200-20)*0.5 = 90: b termina en 110, a quieto.
    expect(relaxed.get("a")!.x).toBeCloseTo(0, 6);
    expect(relaxed.get("b")!.x).toBeCloseTo(110, 6);
  });

  it("deja quieto al vecino que ya está a la distancia de reposo", () => {
    const g = graph(["a", "b"], [["a", "b"]]);
    const positions = new Map([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 200, y: 0 }],
    ]);

    const relaxed = relaxNeighbors(g, positions, "a", { desiredDistance: 200 });

    expect(relaxed.get("a")).toEqual({ x: 0, y: 0 });
    expect(relaxed.get("b")).toEqual({ x: 200, y: 0 });
  });
});
