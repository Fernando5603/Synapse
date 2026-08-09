import { ENTITY_TYPES, RELATION_TYPES, type Node } from "@synapse/graph-core";
import type { Turn } from "./buffer";

export interface PromptInput {
  turns: readonly Turn[];
  nodes: readonly Node[];
}

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
 * Prompt y esquema en inglés, con guard de idioma: la extracción se hace en inglés, y
 * una conversación que no lo sea debe devolver una propuesta vacía.
 */
export function buildPrompt(input: PromptInput): string {
  const turns = input.turns.map((turn, index) => `Speaker ${index + 1}: ${turn.text}`).join("\n");

  const existingNodes =
    input.nodes.length > 0
      ? input.nodes.map((node) => `- ${node.name} (${node.type})`).join("\n")
      : "- (none yet)";

  return `You extract a knowledge graph from a collaborative conversation.

Conversation transcript:
${turns}

Existing nodes in the graph (reuse these exact names, do not create duplicates):
${existingNodes}

Entity types: ${ENTITY_TYPES.join(", ")}.
Relation types: ${RELATION_TYPES.join(", ")}.

Rules:
- Only extract from ENGLISH conversation. If the conversation is not in English, return an empty proposal.
- Nodes refer to each other BY NAME, not by id.
- If a concept already exists in the list above, use its exact name.
- Discard anything that does not fit the closed schema.
- Respond with a single JSON object of the form {"nodes": [{"type": string, "name": string}], "edges": [{"type": string, "from": string, "to": string}]}.
- An empty proposal is valid: {"nodes": [], "edges": []}.`;
}
