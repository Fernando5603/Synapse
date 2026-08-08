import { describe, expect, it } from "vitest";
import type { EntityType, Graph, RelationType } from "../src/index.js";
import { renderDocument } from "../src/index.js";

function node(id: string, type: EntityType, name: string) {
  return { id, type, name };
}

function edge(
  id: string,
  type: RelationType,
  from: string,
  to: string,
) {
  return { id, type, from, to };
}

function graph(nodes: ReturnType<typeof node>[], edges: ReturnType<typeof edge>[] = []): Graph {
  return { nodes, edges, version: nodes.length + edges.length };
}

describe("el documento final de la sesión", () => {
  it("sobre un grafo vacío produce un documento válido, no una excepción", () => {
    const doc = renderDocument(graph([]));
    expect(typeof doc).toBe("string");
    expect(doc.length).toBeGreaterThan(0);
  });

  it("lista cada decisión con su cadena de soporte", () => {
    const g = graph(
      [
        node("d1", "Decision", "Usar modelo híbrido"),
        node("c1", "Claim", "El modelo gratis es más rápido"),
        node("c2", "Claim", "El modelo grande es más preciso"),
        node("c3", "Claim", "La latencia importa"),
      ],
      [
        edge("e1", "SUPPORTS", "c1", "d1"),
        edge("e2", "SUPPORTS", "c2", "d1"),
        edge("e3", "SUPPORTS", "c3", "c1"),
      ],
    );

    const doc = renderDocument(g);

    expect(doc).toContain("Usar modelo híbrido");
    expect(doc).toContain("El modelo gratis es más rápido");
    expect(doc).toContain("El modelo grande es más preciso");
    // La cadena transita: c3 apoya a c1, que apoya a d1.
    expect(doc).toContain("La latencia importa");
  });

  it("lista las contradicciones sin resolver", () => {
    const g = graph(
      [
        node("c1", "Claim", "El modelo gratis basta"),
        node("c2", "Claim", "El modelo gratis no basta"),
      ],
      [edge("e1", "CONTRADICTS", "c2", "c1")],
    );

    const doc = renderDocument(g);

    expect(doc).toContain("El modelo gratis basta");
    expect(doc).toContain("El modelo gratis no basta");
  });

  it("lista una Question sin arista ANSWERS bajo lo que quedó abierto", () => {
    const g = graph([node("q1", "Question", "¿Servirá el modelo gratis?")]);

    const doc = renderDocument(g);

    expect(doc).toContain("¿Servirá el modelo gratis?");
  });

  it("deja de listar una Question cuando tiene una arista ANSWERS", () => {
    const g = graph(
      [
        node("q1", "Question", "¿Servirá el modelo gratis?"),
        node("c1", "Claim", "El modelo gratis basta"),
      ],
      [edge("e1", "ANSWERS", "c1", "q1")],
    );

    const doc = renderDocument(g);

    expect(doc).not.toContain("¿Servirá el modelo gratis?");
  });

  it("una decisión sin soporte se lista igualmente", () => {
    const g = graph([node("d1", "Decision", "Cancelar el proyecto")]);

    const doc = renderDocument(g);

    expect(doc).toContain("Cancelar el proyecto");
  });
});
