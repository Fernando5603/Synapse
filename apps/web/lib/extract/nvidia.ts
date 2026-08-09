import type { Proposal } from "@synapse/graph-core";
import { sanitizeProposal } from "@synapse/graph-core";

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
  /** Límite duro de espera. La política de fallo corre aquí (timeout de 8 s). */
  timeoutMs: number;
  /** Timeout del fetch subyacente; un poco menos que `timeoutMs` para abortar antes. */
  fetchTimeoutMs: number;
}

const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";

/**
 * Cliente real contra NVIDIA BUILD (endpoint compatible con OpenAI).
 *
 * Pide structured output con `response_format: { type: "json_object" }` y sanea la
 * respuesta con `sanitizeProposal`: lo que no cumpla el esquema cerrado se descarta.
 * El lote se aborta y devuelve `undefined` si el modelo no contesta a tiempo.
 */
export function nvidiaExtractor(config: NvidiaConfig): ExtractorClient {
  return {
    async extract(prompt: string): Promise<Proposal | undefined> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.fetchTimeoutMs);

      try {
        const response = await fetch(NVIDIA_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          return undefined;
        }

        const body = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = body.choices?.[0]?.message?.content;
        if (typeof content !== "string" || content.trim() === "") {
          return undefined;
        }

        const parsed: unknown = JSON.parse(content);
        return sanitizeProposal(parsed);
      } catch {
        // Abortado por timeout, red caída, o JSON malformado: el lote se descarta y la
        // política de fallo lo arrastra a la ventana siguiente.
        return undefined;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
