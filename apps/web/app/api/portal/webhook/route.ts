import { extractionRuntime } from "@/lib/extract/runtime";
import { verifyWebhookSignature } from "@/lib/extract/verify";
import { classifyWebhook, type WebhookEvent } from "@/lib/extract/filter";
import { CONTEXT_SIZE, DEBOUNCE_MS, llmExtractor } from "@/lib/extract/config";
import { roomIdFromChannel } from "@/lib/channel";

// El agente vive en un WebSocket y el webhook lee `process.env`: nada de esto puede correr
// en el runtime edge ni quedarse resuelto en build.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secret(): string {
  const value = process.env.PORTAL_WEBHOOK_SECRET;
  if (value === undefined || value === "") {
    throw new Error(
      "Falta PORTAL_WEBHOOK_SECRET. Es el secreto de firma de los webhooks de Portal, " +
        "el que devuelve GET /v1/webhooks/secret con la secret key.",
    );
  }
  return value;
}

function pipelineRuntime(): ReturnType<typeof extractionRuntime> {
  return extractionRuntime({
    extractor: llmExtractor(),
    debounceMs: DEBOUNCE_MS,
    contextSize: CONTEXT_SIZE,
    retries: 1,
  });
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  try {
    verifyWebhookSignature(rawBody, request.headers.get("portal-signature") ?? undefined, secret());
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 401 },
    );
  }

  const event = JSON.parse(rawBody) as WebhookEvent;
  const roomId = roomIdFromChannel(event.channelId);

  // Primera línea: el filtro decide si esto es un turno de chat de una sala. Una
  // retracción, un mensaje del namespace graph.* o un canal que no es room-* no entran,
  // y tampoco crean el runtime de la sala (ni su WebSocket de agente).
  if (event.type !== "message.published" || roomId === undefined) {
    return Response.json({ ok: true });
  }
  if (classifyWebhook(event).kind !== "turn") {
    return Response.json({ ok: true });
  }

  try {
    await pipelineRuntime().forRoom(roomId).pipeline.onMessage(event, Date.now());
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }

  // El pipeline es asíncrono por el debounce: acusar aquí, el trabajo corre en el timer.
  return Response.json({ ok: true });
}
