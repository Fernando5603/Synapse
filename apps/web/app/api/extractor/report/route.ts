import { extractionRuntime } from "@/lib/extract/runtime";
import {
  CONTEXT_SIZE,
  DEBOUNCE_MS,
  DEFAULT_LLM_MODEL,
  GROQ_BASE_URL,
  llmExtractor,
} from "@/lib/extract/config";

// Lee `process.env`: runtime node, nunca edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pipelineRuntime(): ReturnType<typeof extractionRuntime> {
  return extractionRuntime({
    extractor: llmExtractor(),
    debounceMs: DEBOUNCE_MS,
    contextSize: CONTEXT_SIZE,
    retries: 1,
  });
}

/**
 * La métrica del criterio (a) y el estado de la configuración del servidor.
 *
 *     GET /api/extractor/report
 *
 * Lo segundo está aquí porque las dos formas de quedarse sin nodos son **mudas** por
 * diseño: sin `NEXT_GROQ_API_KEY` el extractor se construye en su versión que siempre
 * falla, y sin `PORTAL_WEBHOOK_SECRET` el webhook rechaza cada POST. Las dos dejan la
 * sala funcionando y el grafo vacío, que es exactamente el síntoma más difícil de
 * atribuir. Un vistazo a este endpoint lo separa de un problema del LLM o del túnel.
 *
 * Solo dice si cada clave **está**, nunca su valor.
 */
export async function GET(): Promise<Response> {
  const apiKey = process.env.NEXT_GROQ_API_KEY;
  const baseUrl = process.env.GROQ_BASE_URL ?? GROQ_BASE_URL;

  const config = {
    llmApiKey: present(apiKey),
    portalApiKey: present(process.env.NEXT_PUBLIC_PORTAL_API_KEY),
    webhookSecret: present(process.env.PORTAL_WEBHOOK_SECRET),
    model: process.env.GROQ_LLM_MODEL ?? `(por defecto) ${DEFAULT_LLM_MODEL}`,
    baseUrl,
    /**
     * La key y el endpoint tienen que ser del mismo proveedor.
     *
     * Sustituye al chequeo de namespace del id del modelo, que era una heurística de
     * NVIDIA —allí todo id lleva `meta/`— y con Groq da un falso negativo permanente:
     * `llama-3.3-70b-versatile` no lleva barra. La trampa de ahora es otra: una key de
     * Groq (`gsk_`) apuntando al endpoint de NVIDIA, o al revés, devuelve 401 en cada
     * lote y el grafo se queda vacío sin un error a la vista.
     */
    providerMatches:
      apiKey === undefined || apiKey === ""
        ? false
        : apiKey.startsWith("gsk_") === baseUrl.includes("api.groq.com"),
  };

  const listo =
    config.llmApiKey && config.portalApiKey && config.webhookSecret && config.providerMatches;

  return Response.json({
    listo,
    config,
    lotes: pipelineRuntime().report(),
  });
}

function present(value: string | undefined): boolean {
  return value !== undefined && value !== "";
}
