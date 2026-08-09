import type { Proposal } from "@synapse/graph-core";
import { agentChannel, propose } from "@/lib/agent";

/**
 * Endpoint de prueba del ticket 05: dispara una propuesta **desde el servidor**.
 *
 *     GET  /api/agent/propose?room=<sala>
 *     POST /api/agent/propose   { "room": "<sala>", "proposal"?: Proposal }
 *
 * Es el sustituto del `window.__synapse.propose()` del 04. Sigue sin haber LLM: la
 * propuesta por defecto es fija y el disparo es manual. Lo que cambia es quién habla.
 *
 * La respuesta lleva el `graph.delta` con el que contestó la extensión, así que un `curl`
 * basta para saber si el camino entero está vivo, sin abrir el navegador.
 */

// El agente vive en un WebSocket: nada de esto puede correr en el runtime edge ni quedarse
// resuelto en build.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * La misma propuesta de demo que dispara la consola del navegador, para que el nodo que
 * aparece sea reconocible y el dedupe del ticket 06 tenga algo con lo que colisionar.
 */
const DEMO_PROPOSAL: Proposal = {
  nodes: [
    { type: "Concept", name: "latency" },
    { type: "Claim", name: "latency matters more than perfection" },
  ],
  edges: [
    {
      type: "ELABORATES",
      from: "latency matters more than perfection",
      to: "latency",
    },
  ],
};

export async function GET(request: Request): Promise<Response> {
  const room = new URL(request.url).searchParams.get("room");
  return handle(room, DEMO_PROPOSAL);
}

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const fields = (body ?? {}) as { room?: unknown; proposal?: Proposal };
  const room = typeof fields.room === "string" ? fields.room : null;
  return handle(room, fields.proposal ?? DEMO_PROPOSAL);
}

async function handle(room: string | null, proposal: Proposal): Promise<Response> {
  if (room === null || room === "") {
    return Response.json(
      { ok: false, error: 'Falta la sala: ?room=<sala> o { "room": "<sala>" }.' },
      { status: 400 },
    );
  }

  let outcome;
  try {
    outcome = await propose(room, proposal);
  } catch (cause) {
    // El agente no llegó a hablar: clave de otro entorno, canal que lo rechaza, o una
    // reconexión que no terminó a tiempo. El mensaje del error dice cuál.
    return Response.json(
      { ok: false, error: cause instanceof Error ? cause.message : String(cause) },
      { status: 502 },
    );
  }

  const channel = agentChannel(room);
  return Response.json({
    // `ok` es "la extensión contestó", no "el POST salió": sin delta no hay nada que
    // haya llegado a ninguna pantalla, y decir que sí sería el silencio de siempre.
    ok: outcome.delta !== undefined,
    channelId: channel.info?.id,
    agentId: channel.me?.id,
    status: channel.status,
    attempts: outcome.attempts,
    delta: outcome.delta ?? null,
  });
}
