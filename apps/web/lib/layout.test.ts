import { describe, expect, it } from "vitest";
import { seedPosition } from "./layout";
import { mockSessionGraph } from "./mockGraph";

const BOUNDS = { width: 840, height: 600 };

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
