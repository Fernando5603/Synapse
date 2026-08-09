import type { Proposal } from "@synapse/graph-core";
import { ENTITY_TYPES, RELATION_TYPES, sanitizeProposal } from "@synapse/graph-core";
import { EXTRACTOR_SYSTEM_PROMPT } from "./prompt";

/**
 * Cliente del LLM de extracción, inyectado en el extractor.
 *
 * Vive fuera del seam puro a propósito: el prompt, el buffer y el filtro son puros y
 * testeables; el transporte HTTP al proveedor no se testea (se verifica en el entorno
 * desplegado, como el resto del transporte de Portal).
 */
export interface ExtractorClient {
  /** Devuelve una propuesta a partir del prompt, o `undefined` si el lote falla. */
  extract(prompt: string): Promise<Proposal | undefined>;
}

export interface NvidiaConfig {
  apiKey: string;
  model: string;
  /** Timeout del fetch: aborta la llamada al LLM si no contesta a tiempo. */
  fetchTimeoutMs: number;
}

const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";

/**
 * El esquema de la respuesta, con los tipos como `enum`.
 *
 * Tomado de `ENTITY_TYPES`/`RELATION_TYPES` y no copiado: el esquema cerrado tiene que
 * ser uno solo, y un `enum` rezagado sería peor que no tenerlo — el modelo respetaría una
 * lista que `sanitizeProposal` ya no acepta, y los nodos se caerían después, en silencio.
 */
const PROPOSAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    nodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: [...ENTITY_TYPES] },
          name: { type: "string" },
        },
        required: ["type", "name"],
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: [...RELATION_TYPES] },
          from: { type: "string" },
          to: { type: "string" },
        },
        required: ["type", "from", "to"],
      },
    },
  },
  required: ["nodes", "edges"],
} as const;

/**
 * Cuántas veces se cuenta un fallo del proveedor antes de callarse.
 *
 * Que un fallo del LLM no rompa la sala es la política del ticket 08, pero **mudo no es
 * lo mismo que tolerante**: con `if (!response.ok) return undefined` un id de modelo mal
 * escrito devuelve 404 en cada lote y el sistema entero se comporta como si la
 * conversación no tuviera nada que extraer. Pasó de verdad: `NVIDIA_LLM_MODEL` perdió su
 * prefijo `meta/` y todos los lotes se descartaron sin una línea de log.
 */
const LOGGED_FAILURES_LIMIT = 3;
let loggedFailures = 0;

function reportFailure(detail: string): void {
  if (loggedFailures >= LOGGED_FAILURES_LIMIT) {
    return;
  }
  loggedFailures += 1;
  const suffix = loggedFailures === LOGGED_FAILURES_LIMIT ? " (no se avisa más)" : "";
  console.error(`[synapse] el extractor falló: ${detail}${suffix}`);
}

/**
 * Cliente real contra NVIDIA BUILD (endpoint compatible con OpenAI).
 *
 * Pide structured output con el esquema de 6+6 tipos como `enum` y sanea la respuesta con
 * `sanitizeProposal`: lo que no cumpla el esquema cerrado se descarta igualmente, porque
 * el `enum` es una ayuda al modelo y no una garantía del proveedor. El lote se aborta y
 * devuelve `undefined` si el modelo no contesta a tiempo.
 */
export function nvidiaExtractor(config: NvidiaConfig): ExtractorClient {
  // Si el proveedor rechaza el `json_schema`, se cae a `json_object` y ahí se queda: no
  // tiene sentido volver a intentarlo en cada lote de la sesión.
  let structuredOutput = true;

  async function post(prompt: string, signal: AbortSignal): Promise<Response> {
    return fetch(NVIDIA_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: EXTRACTOR_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        // La extracción no es una tarea creativa: la misma conversación debe dar el mismo
        // grafo en las tres pantallas y en la corrida de evaluación.
        temperature: 0.15,
        top_p: 0.9,
        max_tokens: 800,
        response_format: structuredOutput
          ? { type: "json_schema", json_schema: { name: "proposal", schema: PROPOSAL_SCHEMA } }
          : { type: "json_object" },
      }),
      signal,
    });
  }

  return {
    async extract(prompt: string): Promise<Proposal | undefined> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.fetchTimeoutMs);

      try {
        let response = await post(prompt, controller.signal);

        // Un 400 con el `json_schema` puesto suele ser "este modelo no lo soporta". Se
        // reintenta una vez sin él y se recuerda, en vez de perder todos los lotes.
        if (!response.ok && response.status === 400 && structuredOutput) {
          structuredOutput = false;
          reportFailure(
            `el modelo "${config.model}" rechazó json_schema; se sigue con json_object`,
          );
          response = await post(prompt, controller.signal);
        }

        if (!response.ok) {
          reportFailure(
            `${response.status} de NVIDIA para el modelo "${config.model}" — ` +
              `${(await response.text()).slice(0, 200)}`,
          );
          return undefined;
        }

        const body = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = body.choices?.[0]?.message?.content;
        if (typeof content !== "string" || content.trim() === "") {
          reportFailure("la respuesta del modelo vino vacía");
          return undefined;
        }

        const parsed: unknown = JSON.parse(content);
        return sanitizeProposal(parsed);
      } catch (error) {
        // Abortado por timeout, red caída, o JSON malformado: el lote se descarta y la
        // política de fallo lo arrastra a la ventana siguiente.
        reportFailure(error instanceof Error ? error.message : String(error));
        return undefined;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
