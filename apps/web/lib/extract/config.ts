import { nvidiaExtractor, type ExtractorClient } from "./nvidia";

export const DEBOUNCE_MS = 3_000;
export const CONTEXT_SIZE = 8;
/** El timeout del fetch al LLM. Con `retries: 1` el lote hace dos intentos. */
export const LLM_FETCH_TIMEOUT_MS = 7_000;

/**
 * El extractor real desde el entorno, o un extractor que siempre falla si falta la key.
 * Un solo sitio construye el extractor: el webhook y el reporte lo comparten, así no
 * pueden divergir midiendo pipelines distintos.
 */
export function llmExtractor(): ExtractorClient {
  const apiKey = process.env.NEXT_NVIDIA_API_KEY;
  if (apiKey === undefined || apiKey === "") {
    return { extract: async () => undefined };
  }
  const model = process.env.NVIDIA_LLM_MODEL ?? "meta/llama-3.1-8b-instruct";
  return nvidiaExtractor({
    apiKey,
    model,
    fetchTimeoutMs: LLM_FETCH_TIMEOUT_MS,
  });
}
