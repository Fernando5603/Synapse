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
  { id: "m_1", text: "So the thing is the latency budget.", at: 1000 },
  { id: "m_2", text: "Right, and the debounce eats it.", at: 2000 },
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
    expect(prompt.toLowerCase()).toContain("existing");
  });
});
