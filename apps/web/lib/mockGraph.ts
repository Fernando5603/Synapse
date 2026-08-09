import type { EntityType, Graph, RelationType } from "@synapse/graph-core";

/**
 * Grafo de ejemplo con el tamaño de una sesión real (~40 nodos).
 *
 * Desde el ticket 04 la sala se alimenta de los `graph.delta` de la extensión, así que
 * esto ya no cuelga de `Room`. Se queda como fixture: hasta que el extractor real (07)
 * llene el grafo, es la única forma de mirar el render a escala de sesión y comprobar
 * que 40 nodos siguen siendo legibles.
 */
export function mockSessionGraph(): Graph {
  const entities: { name: string; type: EntityType }[] = [
    { name: "generative AI", type: "Concept" },
    { name: "extraction", type: "Concept" },
    { name: "llama-3.1-8b", type: "Concept" },
    { name: "latency", type: "Concept" },
    { name: "closed schema", type: "Concept" },
    { name: "hybrid pipeline", type: "Concept" },
    { name: "live graph", type: "Concept" },
    { name: "final document", type: "Concept" },
    { name: "evaluation script", type: "Concept" },
    { name: "failure policy", type: "Concept" },
    { name: "gold transcript", type: "Concept" },
    { name: "hackathon clock", type: "Concept" },
    { name: "provider", type: "Concept" },
    { name: "prompt", type: "Concept" },
    { name: "latency matters more than perfection", type: "Claim" },
    { name: "a small model will drown on a messy chat transcript", type: "Claim" },
    { name: "latency is not the point", type: "Claim" },
    { name: "a closed vocabulary helps the weak model", type: "Claim" },
    { name: "the canvas is useless if the graph is garbage", type: "Claim" },
    { name: "an evaluation script is not a luxury", type: "Claim" },
    { name: "a hybrid doubles the moving parts", type: "Claim" },
    { name: "rejecting a hybrid because it has two parts is lazy", type: "Claim" },
    { name: "the document must read the same graph", type: "Claim" },
    { name: "the live graph is the single source of truth", type: "Claim" },
    { name: "failure must never be silent", type: "Claim" },
    { name: "the provider must stay swappable", type: "Claim" },
    { name: "can generative AI do the extraction", type: "Question" },
    { name: "what do we actually need the model to output", type: "Question" },
    { name: "why is Decision in there", type: "Question" },
    { name: "does contradicts have the same logic", type: "Question" },
    { name: "what happens when the small model cannot answer", type: "Question" },
    { name: "are we tied to llama or can we swap", type: "Question" },
    { name: "we ran nothing yet", type: "Evidence" },
    { name: "a free model answers in two seconds", type: "Evidence" },
    { name: "Ronald", type: "Person" },
    { name: "Giano", type: "Person" },
    { name: "Fernando", type: "Person" },
    { name: "live path uses the free model, final document uses the capable model", type: "Decision" },
    { name: "failure policy is settled", type: "Decision" },
    { name: "freeze the gold before tuning the prompt", type: "Decision" },
  ];

  const nodes = entities.map((entity, index) => ({
    id: `n${index + 1}`,
    ...entity,
  }));

  const pairs: { from: number; to: number; type: RelationType }[] = [
    { from: 14, to: 1, type: "ELABORATES" },
    { from: 14, to: 3, type: "CONTRADICTS" },
    { from: 15, to: 14, type: "CONTRADICTS" },
    { from: 16, to: 4, type: "SUPPORTS" },
    { from: 17, to: 5, type: "SUPPORTS" },
    { from: 18, to: 19, type: "ELABORATES" },
    { from: 18, to: 6, type: "CONTRADICTS" },
    { from: 20, to: 18, type: "CONTRADICTS" },
    { from: 21, to: 6, type: "CONTRADICTS" },
    { from: 22, to: 23, type: "SUPPORTS" },
    { from: 22, to: 8, type: "SUPPORTS" },
    { from: 24, to: 9, type: "ELABORATES" },
    { from: 25, to: 13, type: "SUPPORTS" },
    { from: 26, to: 14, type: "PROPOSED_BY" },
    { from: 26, to: 35, type: "PROPOSED_BY" },
    { from: 27, to: 14, type: "PROPOSED_BY" },
    { from: 28, to: 5, type: "ANSWERS" },
    { from: 29, to: 5, type: "ELABORATES" },
    { from: 30, to: 9, type: "ANSWERS" },
    { from: 31, to: 2, type: "ANSWERS" },
    { from: 32, to: 9, type: "ELABORATES" },
    { from: 33, to: 14, type: "SUPPORTS" },
    { from: 34, to: 3, type: "SUPPORTS" },
    { from: 37, to: 33, type: "PROPOSED_BY" },
    { from: 38, to: 33, type: "PROPOSED_BY" },
    { from: 38, to: 34, type: "PROPOSED_BY" },
    { from: 36, to: 34, type: "PROPOSED_BY" },
    { from: 35, to: 32, type: "PROPOSED_BY" },
    { from: 39, to: 9, type: "RESOLVES" },
    { from: 40, to: 29, type: "RESOLVES" },
  ];

  const edges = pairs.map((pair, index) => ({
    id: `e${index + 1}`,
    type: pair.type,
    from: nodes[pair.from - 1]!.id,
    to: nodes[pair.to - 1]!.id,
  }));

  return { nodes, edges, version: 0 };
}
