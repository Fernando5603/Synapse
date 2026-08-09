import { extractionRuntime } from "@/lib/extract/runtime";
import { CONTEXT_SIZE, DEBOUNCE_MS, llmExtractor } from "@/lib/extract/config";

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
 * diseño: sin `NEXT_NVIDIA_API_KEY` el extractor se construye en su versión que siempre
 * falla, y sin `PORTAL_WEBHOOK_SECRET` el webhook rechaza cada POST. Las dos dejan la
 * sala funcionando y el grafo vacío, que es exactamente el síntoma más difícil de
 * atribuir. Un vistazo a este endpoint lo separa de un problema del LLM o del túnel.
 *
 * Solo dice si cada clave **está**, nunca su valor.
 */
export async function GET(): Promise<Response> {
  const config = {
    nvidiaApiKey: present(process.env.NEXT_NVIDIA_API_KEY),
    portalApiKey: present(process.env.NEXT_PUBLIC_PORTAL_API_KEY),
    webhookSecret: present(process.env.PORTAL_WEBHOOK_SECRET),
    model: process.env.NVIDIA_LLM_MODEL ?? "(por defecto) meta/llama-3.1-8b-instruct",
    // El id del modelo lleva namespace. Sin él, NVIDIA devuelve 404 en cada lote.
    modelLooksValid: (process.env.NVIDIA_LLM_MODEL ?? "meta/x").includes("/"),
  };

  const listo =
    config.nvidiaApiKey && config.portalApiKey && config.webhookSecret && config.modelLooksValid;

  return Response.json({
    listo,
    config,
    lotes: pipelineRuntime().report(),
  });
}

function present(value: string | undefined): boolean {
  return value !== undefined && value !== "";
}
