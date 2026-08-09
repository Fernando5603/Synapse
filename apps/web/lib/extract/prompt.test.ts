import { describe, expect, it } from "vitest";
import type { Node } from "@synapse/graph-core";
import { buildPrompt } from "./prompt";

function node(id: string, type: Node["type"], name: string): Node {
  return { id, type, name };
}

const nodes = [
  node("concept-latency", "Concept", "latency"),
  node("claim-latency-matter-mor-than-perfection", "Claim", "latency matters more than perfection"),
];

const turns = [
  { id: "m_1", text: "So the thing is the latency budget.", at: 1000, speaker: "Ronald" },
  { id: "m_2", text: "Right, and the debounce eats it.", at: 2000, speaker: "Giano" },
];

describe("el prompt del extractor", () => {
  it("lleva la ventana de turnos", () => {
    const prompt = buildPrompt({ turns, nodes });
    expect(prompt).toContain("So the thing is the latency budget.");
    expect(prompt).toContain("Right, and the debounce eats it.");
  });

  it("lleva la lista completa de nodos existentes", () => {
    const prompt = buildPrompt({ turns, nodes });
    expect(prompt).toContain("latency");
    expect(prompt).toContain("latency matters more than perfection");
  });

  it("lleva el esquema cerrado de 6+6 tipos", () => {
    const prompt = buildPrompt({ turns, nodes });
    expect(prompt).toContain("Claim");
    expect(prompt).toContain("Concept");
    expect(prompt).toContain("Question");
    expect(prompt).toContain("Evidence");
    expect(prompt).toContain("Person");
    expect(prompt).toContain("Decision");
    expect(prompt).toContain("SUPPORTS");
    expect(prompt).toContain("CONTRADICTS");
    expect(prompt).toContain("ELABORATES");
    expect(prompt).toContain("ANSWERS");
    expect(prompt).toContain("PROPOSED_BY");
    expect(prompt).toContain("RESOLVES");
  });

  it("incluye el guard de idioma: solo extrae de inglés", () => {
    const prompt = buildPrompt({ turns, nodes });
    expect(prompt.toLowerCase()).toContain("english");
  });

  it("pide reusar los nombres ya existentes en vez de duplicarlos", () => {
    const prompt = buildPrompt({ turns, nodes });
    expect(prompt.toLowerCase()).toContain("reuse the exact name");
  });

  it("atribuye cada turno a quien lo dijo, por su nombre", () => {
    // Con «Speaker 1/2/3» numerados por posición en la ventana, la misma persona
    // cambiaba de etiqueta entre lotes y PROPOSED_BY no tenía a quién apuntar.
    const prompt = buildPrompt({ turns, nodes });

    expect(prompt).toContain("Ronald: So the thing is the latency budget.");
    expect(prompt).toContain("Giano: Right, and the debounce eats it.");
  });

  it("cae a una etiqueta genérica si el roster todavía no conoce a quien habló", () => {
    const prompt = buildPrompt({
      turns: [{ id: "m_1", text: "Hello there.", at: 1000 }],
      nodes,
    });

    expect(prompt).toContain("Participant: Hello there.");
  });

  it("dice explícitamente que un grafo vacío no es un error", () => {
    // El primer lote de una sala siempre llega con la lista vacía; sin esta frase el
    // modelo se inventa que le falta contexto.
    const prompt = buildPrompt({ turns, nodes: [] });

    expect(prompt).toContain("the graph is empty");
  });

  it("no inyecta ejemplos con términos ajenos al tema real", () => {
    const prompt = buildPrompt({ turns: [{ id: "m_1", text: "We should ship the small model.", at: 1000, speaker: "Ronald" }], nodes: [] });

    expect(prompt).not.toContain("latency");
    expect(prompt).toContain("small model");
  });
});
