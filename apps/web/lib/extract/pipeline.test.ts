import { afterEach, describe, expect, it, vi } from "vitest";
import type { Proposal } from "@synapse/graph-core";
import { createMirror } from "./mirror";
import { createPipeline } from "./pipeline";
import type { WebhookEvent } from "./filter";

afterEach(() => {
  vi.useRealTimers();
});

function event(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  return {
    id: "m_1",
    type: "message.published",
    channelId: "room-demo",
    data: {
      type: "message",
      content: { text: "the latency matters" },
      sender: { id: "u_1", anon: true },
      ephemeral: false,
    },
    ...overrides,
  };
}

function failingExtractor() {
  return { extract: async () => undefined };
}

describe("el pipeline de extracción", () => {
  it("no entrega nada para un evento no persistido", async () => {
    const pipeline = createPipeline({
      extractor: failingExtractor(),
      mirror: createMirror(),
      debounceMs: 3000,
      contextSize: 8,
      retries: 1,
      deliver: async () => {
        throw new Error("no debería entregar");
      },
    });

    const result = await pipeline.onMessage(
      event({ type: "message.retracted" }),
      1000,
    );
    expect(result).toBeNull();
  });

  it("ignora los mensajes del namespace graph.*", async () => {
    const pipeline = createPipeline({
      extractor: failingExtractor(),
      mirror: createMirror(),
      debounceMs: 3000,
      contextSize: 8,
      retries: 1,
      deliver: async () => {
        throw new Error("no debería entregar");
      },
    });

    const result = await pipeline.onMessage(
      event({
        data: { type: "graph.delta", content: {}, sender: { id: "ext", anon: true }, ephemeral: false },
      }),
      1000,
    );
    expect(result).toBeNull();
  });
});

describe("la política de fallo del lote", () => {
  it("arrastra los turnos a la ventana siguiente cuando el LLM falla", async () => {
    vi.useFakeTimers();
    let extract: () => Promise<Proposal | undefined> = async () => undefined;
    const extractor = { extract: () => extract() };
    const mirror = createMirror();
    const delivered: Proposal[] = [];
    const pipeline = createPipeline({
      extractor,
      mirror,
      debounceMs: 3000,
      contextSize: 8,
      retries: 1,
      deliver: async (_room, proposal) => {
        delivered.push(proposal);
      },
    });

    // Primer turno; el lote se cierra a los 3000 ms. El extractor falla (undefined).
    await pipeline.onMessage(event(), 1000);
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.resolve();

    // El turno no se pierde: el lote siguiente, con el extractor arreglado, lo entrega.
    extract = async () => ({ nodes: [], edges: [] });
    await pipeline.onMessage(event({ id: "m_2" }), 5000);
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.resolve();

    expect(delivered).toEqual([{ nodes: [], edges: [] }]);
  });

  it("arrastra los turnos cuando la entrega falla", async () => {
    vi.useFakeTimers();
    const extractor = { extract: async () => ({ nodes: [], edges: [] }) };
    const mirror = createMirror();
    const delivered: Proposal[] = [];
    let deliverFails = true;
    const pipeline = createPipeline({
      extractor,
      mirror,
      debounceMs: 3000,
      contextSize: 8,
      retries: 1,
      deliver: async (_room, proposal) => {
        if (deliverFails) {
          throw new Error("entrega falló");
        }
        delivered.push(proposal);
      },
    });

    await pipeline.onMessage(event(), 1000);
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.resolve();
    expect(delivered).toHaveLength(0);

    deliverFails = false;
    await pipeline.onMessage(event({ id: "m_2" }), 5000);
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.resolve();
    expect(delivered).toHaveLength(1);
  });

  it("no pierde un turno que llegó a mitad de la extracción", async () => {
    vi.useFakeTimers();
    const extractor = { extract: async () => ({ nodes: [], edges: [] }) };
    const mirror = createMirror();
    const delivered: Proposal[] = [];
    const pipeline = createPipeline({
      extractor,
      mirror,
      debounceMs: 3000,
      contextSize: 8,
      retries: 1,
      deliver: async (_room, proposal) => {
        delivered.push(proposal);
      },
    });

    await pipeline.onMessage(event(), 1000);
    await vi.advanceTimersByTimeAsync(3000);
    // El turno llega mientras el primer lote se está extrayendo y entregando.
    await pipeline.onMessage(event({ id: "m_2" }), 4000);
    await Promise.resolve();
    // El primer lote entrega su propuesta; el segundo turno sigue esperando.
    expect(delivered).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(3000);
    await Promise.resolve();
    expect(delivered).toHaveLength(2);
  });
});
