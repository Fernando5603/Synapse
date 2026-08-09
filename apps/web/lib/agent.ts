import { Portal, type ChannelHandle, type Unsubscribe } from "@portalsdk/core";
import type { Delta, Proposal } from "@synapse/graph-core";
import {
  GRAPH_DELTA_TYPE,
  GRAPH_PROPOSAL_TYPE,
  channelIdFor,
  isDeltaContent,
  type ChannelContent,
} from "./channel";

/**
 * El agente de Synapse como participante del canal (C3.4-B).
 *
 * Este módulo es **solo de servidor**: mantiene un cliente headless de `@portalsdk/core`
 * conectado por WebSocket a cada sala en la que trabaja, y le entrega propuestas a la
 * extensión `graph-owner` con el mismo `send()` que usa el navegador.
 *
 * Que sea el mismo camino es el punto: la extensión no distingue al agente de una persona,
 * y el agente aparece en el roster de la sala en vez de empujar desde fuera.
 */

/** Cómo se presenta el agente en la presencia de la sala. */
const AGENT_DISPLAY_NAME = "Synapse";

/**
 * Cuánto espera un `propose` a que el canal vuelva a estar `ready`. Generoso a propósito:
 * lo que cubre no es la primera conexión (que tarda menos de un segundo) sino la ventana
 * de una reconexión, y esperar es infinitamente mejor que perder la propuesta.
 */
const READY_TIMEOUT_MS = 15_000;

/**
 * Cuánto espera una propuesta al `graph.delta` con el que la extensión acusa el batch antes
 * de darla por perdida. Medido en el 05: una sala tranquila contesta en decenas de
 * milisegundos, y una reconexión completa tarda alrededor de un segundo. Con este margen el
 * peor caso —perder la primera y reenviar— cabe holgado en los 5 s del criterio (a).
 *
 * Pasarse de generoso cuesta latencia en el único caso que importa; quedarse corto solo
 * cuesta una propuesta repetida, que el merge deduplica.
 */
const DELIVERY_TIMEOUT_MS = 2_500;

/** Un reintento y no más: si la segunda tampoco vuelve, el problema no es la reconexión. */
const MAX_ATTEMPTS = 2;

/** Lo que se sabe de una propuesta después de intentar entregarla. */
export interface ProposeOutcome {
  /** El delta que confirmó la entrega, o `undefined` si nunca volvió ninguno. */
  delta: Delta | undefined;
  /** `2` cuando hizo falta reenviar porque la primera se perdió en una reconexión. */
  attempts: number;
}

interface AgentRuntime {
  portal: Portal;
  /**
   * Un handle por sala, adquirido y nunca liberado mientras viva el proceso. Crece con
   * cada sala distinta que se pida y no se poda: las salas concurrentes están fuera de
   * alcance, y una sala menos es un socket que el agente deja de escuchar.
   */
  rooms: Map<string, ChannelHandle<ChannelContent>>;
}

// El runtime cuelga de `globalThis` porque el hot reload de `next dev` reevalúa el módulo
// en cada cambio: sin esto, cada edición abriría un WebSocket nuevo y dejaría el anterior
// vivo, y la sala acabaría con una fila de agentes fantasma en el roster.
const globalForAgent = globalThis as unknown as { __synapseAgent?: AgentRuntime };

function runtime(): AgentRuntime {
  const existing = globalForAgent.__synapseAgent;
  if (existing !== undefined) {
    return existing;
  }

  const apiKey = process.env.NEXT_PUBLIC_PORTAL_API_KEY;
  if (apiKey === undefined || apiKey === "") {
    throw new Error(
      "Falta NEXT_PUBLIC_PORTAL_API_KEY. El agente acuña su token anónimo con la misma " +
        "publishable key que el navegador: si son de entornos distintos, el canal funciona " +
        "y las extensiones no existen, sin un solo error.",
    );
  }

  // Sin `token`: el SDK acuña y renueva por su cuenta una credencial anónima contra
  // `POST /v1/tokens/anonymous` con la publishable key. Vive en memoria, sin `localStorage`,
  // así que en Node el agente estrena identidad en cada arranque del proceso.
  const created: AgentRuntime = { portal: new Portal({ apiKey }), rooms: new Map() };
  globalForAgent.__synapseAgent = created;
  return created;
}

/**
 * El canal de una sala, visto por el agente. Lookup-or-create: la primera llamada abre la
 * conexión y las siguientes devuelven el mismo handle.
 */
export function agentChannel(roomId: string): ChannelHandle<ChannelContent> {
  const { portal, rooms } = runtime();

  const existing = rooms.get(roomId);
  if (existing !== undefined) {
    return existing;
  }

  const channel = portal.channel<ChannelContent>(channelIdFor(roomId), {
    // El agente no lee el historial: los turnos se los trae el webhook y el grafo se lo
    // dice la extensión. Pedir backfill solo sería una petición HTTP que nadie mira.
    history: "none",
    metadata: { displayName: AGENT_DISPLAY_NAME, service: true },
  });

  // `acquire()` sin `release()`: el agente se queda en la sala. El registro de `Portal` es
  // débil —un handle sin referencias se recrea—, así que el `Map` también lo sostiene.
  channel.acquire();
  rooms.set(roomId, channel);
  return channel;
}

/**
 * Entrega una propuesta a la extensión `graph-owner` de la sala y espera a que conteste.
 *
 * El `graph.delta` que vuelve es el acuse de recibo: **este `send()` no tiene otro**. Un
 * tipo de extensión con transporte `ws` se escribe en el socket y la promesa resuelve sola,
 * sin esperar respuesta del servidor, así que "resolvió" no significa "llegó".
 *
 * Y el hueco existe de verdad: al cortar el socket, `channel.status` sigue diciendo `ready`
 * hasta que el SDK se entera del cierre. Un `send()` en ese instante se escribe en la nada.
 * Medido con un proxy local en el ticket 05 — la propuesta se perdió sin un solo error.
 *
 * De ahí el reintento: si no vuelve delta, se espera a que el canal se restablezca y se
 * manda otra vez. Reenviar es seguro porque `mergeProposal` deduplica por nombre, así que
 * una propuesta entregada dos veces produce el mismo grafo que entregada una.
 */
export async function propose(
  roomId: string,
  proposal: Proposal,
): Promise<ProposeOutcome> {
  const channel = agentChannel(roomId);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await whenReady(channel);

    // Escuchar antes de enviar: el delta de una sala tranquila vuelve en decenas de
    // milisegundos y llegaría antes de que nadie estuviera esperándolo.
    const confirmation = nextDelta(channel);
    await channel.send({ type: GRAPH_PROPOSAL_TYPE, content: proposal });

    const delta = await confirmation;
    if (delta !== undefined) {
      return { delta, attempts: attempt };
    }
  }

  return { delta: undefined, attempts: MAX_ATTEMPTS };
}

/**
 * El primer `graph.delta` que entre al canal, o `undefined` si no entra ninguno a tiempo.
 *
 * No distingue el delta de esta propuesta del de la propuesta de otro: la extensión no
 * correlaciona respuestas con mensajes. Es aceptable para lo que se usa —decidir si hace
 * falta reenviar— porque las dos equivocaciones son inofensivas: confirmar de más pierde
 * una propuesta que el turno siguiente vuelve a proponer, y confirmar de menos reenvía una
 * propuesta que el merge deduplica.
 */
function nextDelta(channel: ChannelHandle<ChannelContent>): Promise<Delta | undefined> {
  return new Promise<Delta | undefined>((resolve) => {
    let settle: (delta: Delta | undefined) => void = () => {};

    const unsubscribe = channel.on("message", (message) => {
      if (message.type === GRAPH_DELTA_TYPE && isDeltaContent(message.content)) {
        settle(message.content);
      }
    });
    const timer = setTimeout(() => settle(undefined), DELIVERY_TIMEOUT_MS);

    settle = (delta) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(delta);
    };
  });
}

/**
 * Espera a que el canal esté `ready`, o falla diciendo en qué estado se quedó.
 *
 * No vale `degraded-http`, que suena a "se puede publicar": ahí el socket está caído y el
 * publish HTTP es justo el camino que un `send()` de tipo de extensión no usa.
 *
 * Esta puerta es necesaria pero no suficiente —el estado tarda unos milisegundos en
 * enterarse de que el socket murió—, y eso es lo que cubre el reintento de `propose`.
 */
async function whenReady(channel: ChannelHandle<ChannelContent>): Promise<void> {
  if (channel.status === "ready") {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let unsubscribe: Unsubscribe | undefined;

    const settle = (outcome: () => void) => {
      clearTimeout(timer);
      unsubscribe?.();
      outcome();
    };

    const timer = setTimeout(() => {
      settle(() =>
        reject(
          new Error(
            `El agente sigue en "${channel.status}" tras ${READY_TIMEOUT_MS} ms sin llegar a "ready".`,
          ),
        ),
      );
    }, READY_TIMEOUT_MS);

    unsubscribe = channel.on("status", (status, error) => {
      // `reconnecting` y `degraded-http` no se tocan: son transitorios y el socket vuelve
      // solo. `blocked` sí es terminal —clave mala, aforo, expulsión—, y esperarlo hasta el
      // timeout solo retrasaría el mismo fallo.
      if (status === "ready") {
        settle(resolve);
      } else if (status === "blocked") {
        settle(() =>
          reject(error ?? new Error("El canal rechazó al agente de forma terminal.")),
        );
      }
    });

    // Después de suscribirse, no antes: entre la comprobación y el `on` cabe un `ready`.
    if (channel.status === "ready") {
      settle(resolve);
    }
  });
}
