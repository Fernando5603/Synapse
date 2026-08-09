import { ENTITY_TYPES, RELATION_TYPES, type Node } from "@synapse/graph-core";
import type { Turn } from "./buffer";

export interface PromptInput {
  turns: readonly Turn[];
  nodes: readonly Node[];
}

/**
 * El papel del modelo. Va en el mensaje `system` y no en el `user` porque es lo único
 * del prompt que no cambia entre lotes: separarlo deja el turno del usuario siendo
 * exactamente los datos, que es lo que un modelo de 8B sigue mejor.
 */
export const EXTRACTOR_SYSTEM_PROMPT = `You are the knowledge-graph extractor of a live collaborative canvas. You read the last few turns of a discussion and return ONLY the new things those turns added, as a single JSON object.

You are strict about two things: the closed schema, and reusing names that already exist in the graph. You never explain yourself and you never write prose.`;

/**
 * Las definiciones de los tipos.
 *
 * Un modelo de capa gratuita no sabe qué separa un `Claim` de un `Concept` solo con el
 * nombre del tipo — y esa confusión es la que más precisión cuesta, porque un `Concept`
 * escrito como afirmación no casa con ningún nodo del gold ni deduplica con nada. Cada
 * tipo lleva su definición y un ejemplo corto; los ejemplos son del dominio del guion a
 * propósito, para que el modelo vea la granularidad que se espera.
 */
const TYPE_GUIDE = `THE TEST that decides Claim vs Concept, apply it to every node:
Could someone reply "no, that is wrong"? Then it is a Claim. If it is just a thing you could point at, it is a Concept.
  "latency"                              -> Concept (a thing)
  "latency matters more than perfection"  -> Claim   (you can disagree)
  "failure policy"                        -> Concept
  "failure must never be silent"          -> Claim
A Concept is NEVER a full sentence. A Claim is NEVER a bare noun.

Entity types — pick the single best fit:
- Concept: a thing, tool, technique or topic being discussed. 1 to 3 words, a bare noun phrase.
- Claim: a debatable assertion someone makes, in the speaker's own words, as a short statement.
- Question: something explicitly asked and not yet settled. e.g. "what evidence do we have"
- Evidence: a concrete observation, number or result offered as support. e.g. "the pilot scored 61 percent"
- Decision: something the group settled on doing. e.g. "ship with the small model"
- Person: a participant, only when they are talked about by name.

Relation types — always written as from -> to:
- SUPPORTS: the source is a reason to believe the target
- CONTRADICTS: the source is incompatible with the target
- ELABORATES: the source adds detail to the target
- ANSWERS: a Claim, Evidence or Decision that settles a Question
- RESOLVES: a Decision that closes a disagreement
- PROPOSED_BY: an idea to the Person who raised it`;

/**
 * Un ejemplo resuelto.
 *
 * Un solo disparo, y sobre dos turnos que se contradicen: es el caso que el producto
 * necesita acertar (el aviso dirigido del ticket 11 vive de un `CONTRADICTS`) y el que
 * un modelo pequeño más falla, porque tiende a emitir dos `Claim` sueltos sin la arista.
 */
const EXAMPLE = `Example.
Conversation:
Giano: The free tier models are cheap and fast, and latency matters more than perfection here.
Fernando: I disagree, a small model will drown on a messy transcript.
Response:
{"nodes":[{"type":"Concept","name":"free tier model"},{"type":"Claim","name":"latency matters more than perfection"},{"type":"Claim","name":"small models drown on messy transcripts"}],"edges":[{"type":"ELABORATES","from":"latency matters more than perfection","to":"free tier model"},{"type":"CONTRADICTS","from":"small models drown on messy transcripts","to":"latency matters more than perfection"}]}`;

/**
 * Construye el prompt del extractor.
 *
 * Lleva la ventana de turnos, la lista completa de nodos existentes y el esquema
 * cerrado de 6+6 tipos — tomado de `ENTITY_TYPES`/`RELATION_TYPES` de graph-core,
 * no copiado, para que un cambio de esquema no deje el prompt rezagado en silencio.
 *
 * La lista de nodos es el lazo con la verdad: el LLM debe reusar los nombres que ya
 * existen en vez de duplicarlos, porque el dedupe de la extensión acaba haciendo todo
 * el trabajo si el prompt deriva.
 *
 * Los turnos van con **el nombre de quien habló**, no con «Speaker 1/2/3». La numeración
 * anterior era por índice dentro de la ventana, así que la misma persona cambiaba de
 * número entre un lote y el siguiente: el modelo no podía atribuir nada, y `PROPOSED_BY`
 * —que es un tipo del esquema y una fila del gold— no tenía a quién apuntar.
 *
 * Prompt y esquema en inglés, con guard de idioma: la extracción se hace en inglés, y
 * una conversación que no lo sea debe devolver una propuesta vacía.
 */
export function buildPrompt(input: PromptInput): string {
  const turns = input.turns
    .map((turn) => `${turn.speaker ?? "Participant"}: ${turn.text}`)
    .join("\n");

  const existingNodes =
    input.nodes.length > 0
      ? input.nodes.map((node) => `- ${node.name} (${node.type})`).join("\n")
      : "- (the graph is empty; everything you extract is new)";

  return `${TYPE_GUIDE}

Nodes already in the graph. If a turn talks about one of these, REUSE THE EXACT NAME below instead of inventing a variant:
${existingNodes}

Recent conversation:
${turns}

Rules:
- Only extract from ENGLISH conversation. If the conversation is not in English, return an empty proposal.
- Extract only what these turns actually say. Never infer, never summarise the topic in general.
- A name is lowercase with no trailing punctuation: 1 to 3 words for a Concept, up to 10 for the others.
- Keep the speaker's own wording for a Claim, a Question and a Decision. Do not rephrase into your own terms.
- Never split one idea into a node for each of its words: "three second debounce" is one Concept, not "debounce" plus "three seconds".
- Edges refer to nodes BY NAME, never by id. Every name in an edge must appear either in the list above or in your own "nodes".
- Prefer few precise nodes over many vague ones: 0 to 6 nodes per response.
- Entity types: ${ENTITY_TYPES.join(", ")}. Relation types: ${RELATION_TYPES.join(", ")}. Discard anything that does not fit.
- If these turns add nothing new (greetings, logistics, small talk), return {"nodes": [], "edges": []}. An empty proposal is valid.

Respond with a single JSON object of the form {"nodes": [{"type": string, "name": string}], "edges": [{"type": string, "from": string, "to": string}]}.

${EXAMPLE}`;
}
