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
 * La métrica del criterio (a): p95 de los lotes completados y porcentaje que salió por
 * la rama de descarte. El spec manda reportarlos por separado, o el número miente.
 *
 *     GET /api/extractor/report
 */
export async function GET(): Promise<Response> {
  return Response.json(pipelineRuntime().report());
}
