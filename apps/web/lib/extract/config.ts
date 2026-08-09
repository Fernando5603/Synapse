import { openAiCompatibleExtractor, type ExtractorClient } from "./llm";

export const DEBOUNCE_MS = 3_000;
export const CONTEXT_SIZE = 8;
/** El timeout del fetch al LLM. Con `retries: 1` el lote hace dos intentos. */
export const LLM_FETCH_TIMEOUT_MS = 7_000;

/**
 * El proveedor por defecto: Groq.
 *
 * Se cambió desde NVIDIA BUILD porque era la única palanca que quedaba para el criterio
 * (b) (ver `internal/handoff-extractor-llm.md`). En NVIDIA, `meta/llama-3.1-8b-instruct`
 * era el único modelo que cumplía la latencia y su redacción de los nombres no llegaba al
 * umbral; en Groq, `llama-3.3-70b-versatile` contesta el prompt real en ~1.4 s.
 */
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_LLM_MODEL = "llama-3.3-70b-versatile";

/**
 * El extractor real desde el entorno, o un extractor que siempre falla si falta la key.
 * Un solo sitio construye el extractor: el webhook y el reporte lo comparten, así no
 * pueden divergir midiendo pipelines distintos.
 */
export function llmExtractor(): ExtractorClient {
  const apiKey = process.env.NEXT_GROQ_API_KEY;
  if (apiKey === undefined || apiKey === "") {
    return { extract: async () => undefined };
  }
  return openAiCompatibleExtractor({
    apiKey,
    model: process.env.GROQ_LLM_MODEL ?? DEFAULT_LLM_MODEL,
    baseUrl: process.env.GROQ_BASE_URL ?? GROQ_BASE_URL,
    fetchTimeoutMs: LLM_FETCH_TIMEOUT_MS,
  });
}
