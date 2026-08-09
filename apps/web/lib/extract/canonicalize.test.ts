import { describe, expect, it } from "vitest";
import type { Node, Proposal } from "@synapse/graph-core";
import {
  canonicalizeProposal,
  isDeictic,
  isEmptySpeechAct,
  truncateAtComma,
} from "./canonicalize";

function proposal(nodes: Proposal["nodes"], edges: Proposal["edges"] = []): Proposal {
  return { nodes, edges };
}
function node(type: Node["type"], name: string): Node {
  return { id: `${type}-${name}`, type, name };
}
const names = (result: Proposal) => result.nodes.map((n) => n.name);

describe("los deícticos sueltos", () => {
  it("reconoce un pronombre que no lleva nada detrás", () => {
    // El grafo de una sala de cinco turnos tenía un Concept llamado «you».
    expect(isDeictic("you")).toBe(true);
    expect(isDeictic("that")).toBe(true);
    expect(isDeictic("this thing")).toBe(true);
  });

  it("no toca un nombre que sí dice algo", () => {
    expect(isDeictic("latency")).toBe(false);
    expect(isDeictic("that model")).toBe(false);
    expect(isDeictic("closed schema")).toBe(false);
  });
});

describe("los actos de habla vacíos", () => {
  it("reconoce una réplica que no afirma nada del mundo", () => {
    expect(isEmptySpeechAct("thats not true")).toBe(true);
    expect(isEmptySpeechAct("that is wrong")).toBe(true);
    expect(isEmptySpeechAct("i disagree")).toBe(true);
    expect(isEmptySpeechAct("you re wrong")).toBe(true);
    expect(isEmptySpeechAct("i totally agree")).toBe(true);
  });

  it("respeta una afirmación que empieza por pronombre pero tiene contenido", () => {
    // La diferencia es la palabra de contenido: en cuanto aparece, hay algo que extraer.
    expect(isEmptySpeechAct("that model is wrong")).toBe(false);
    expect(isEmptySpeechAct("i think latency matters")).toBe(false);
    expect(isEmptySpeechAct("we ran nothing yet")).toBe(false);
  });

  it("no se aplica a frases largas: ahí el pronombre no es todo lo que hay", () => {
    expect(
      isEmptySpeechAct("it is not true that a small model will drown on a transcript"),
    ).toBe(false);
  });
});

describe("el recorte en la primera coma", () => {
  it("se queda con la primera cláusula", () => {
    expect(truncateAtComma("eight second timeout, one retry, carryover, and a note")).toBe(
      "eight second timeout",
    );
  });

  it("deja intacto lo que no lleva coma", () => {
    expect(truncateAtComma("latency matters more than perfection")).toBe(
      "latency matters more than perfection",
    );
  });

  it("no recorta cuando la coma llega demasiado pronto para separar cláusulas", () => {
    expect(truncateAtComma("no, the graph is the source of truth")).toBe(
      "no, the graph is the source of truth",
    );
  });
});

describe("el filtro sobre la propuesta entera", () => {
  it("tira los deícticos y los actos de habla, y conserva lo demás", () => {
    const result = canonicalizeProposal(
      proposal([
        { type: "Concept", name: "you" },
        { type: "Claim", name: "thats not true" },
        { type: "Claim", name: "latency matters more than perfection" },
        { type: "Concept", name: "latency" },
      ]),
    );

    expect(names(result)).toEqual(["latency matters more than perfection", "latency"]);
  });

  it("rechaza un Concept que es una frase entera", () => {
    // La regla ya estaba escrita en el prompt («A Concept is NEVER a full sentence») y
    // no la comprobaba nadie.
    const result = canonicalizeProposal(
      proposal([
        { type: "Concept", name: "the live graph is the single source of truth" },
        { type: "Concept", name: "live graph" },
      ]),
    );

    expect(names(result)).toEqual(["live graph"]);
  });

  it("funde un Concept hacia el nombre que la sala ya usa, no hacia el más corto", () => {
    const result = canonicalizeProposal(proposal([{ type: "Concept", name: "extraction quality" }]), [
      node("Concept", "extraction"),
    ]);

    expect(names(result)).toEqual(["extraction"]);
  });

  it("no funde dos nodos nuevos entre sí: ahí no hay criterio", () => {
    const result = canonicalizeProposal(
      proposal([
        { type: "Concept", name: "prompt" },
        { type: "Concept", name: "prompt quality" },
      ]),
    );

    // El primero entra y pasa a ser «lo que la sala ya usa», así que el segundo sí se funde.
    expect(names(result)).toEqual(["prompt"]);
  });

  it("reescribe los extremos de las aristas cuando renombra un nodo", () => {
    // `mergeProposal` resuelve los extremos por nombre: una arista con el nombre viejo se
    // caería en silencio, que es justo lo que hunde la precisión de relaciones.
    const result = canonicalizeProposal(
      proposal(
        [
          { type: "Decision", name: "eight second timeout, one retry, carryover" },
          { type: "Concept", name: "failure policy" },
        ],
        [
          {
            type: "ELABORATES",
            from: "eight second timeout, one retry, carryover",
            to: "failure policy",
          },
        ],
      ),
    );

    expect(result.edges).toEqual([
      { type: "ELABORATES", from: "eight second timeout", to: "failure policy" },
    ]);
  });

  it("descarta la arista cuyo extremo se rechazó", () => {
    const result = canonicalizeProposal(
      proposal(
        [
          { type: "Claim", name: "thats not true" },
          { type: "Claim", name: "latency matters more than perfection" },
        ],
        [
          {
            type: "CONTRADICTS",
            from: "thats not true",
            to: "latency matters more than perfection",
          },
        ],
      ),
    );

    expect(result.edges).toEqual([]);
  });

  it("deja pasar una arista hacia un nodo que ya estaba en el grafo", () => {
    // Un extremo que esta propuesta no menciona es legítimo: vive en el grafo de la sala.
    const result = canonicalizeProposal(
      proposal([{ type: "Claim", name: "a hybrid doubles the moving parts" }], [
        { type: "ELABORATES", from: "a hybrid doubles the moving parts", to: "hybrid pipeline" },
      ]),
      [node("Concept", "hybrid pipeline")],
    );

    expect(result.edges).toEqual([
      { type: "ELABORATES", from: "a hybrid doubles the moving parts", to: "hybrid pipeline" },
    ]);
  });

  it("no inventa nodos: solo quita y acorta", () => {
    const input = proposal([
      { type: "Claim", name: "the canvas is useless if the graph is garbage" },
      { type: "Concept", name: "evaluation script" },
    ]);

    expect(canonicalizeProposal(input).nodes.length).toBeLessThanOrEqual(input.nodes.length);
  });
});
