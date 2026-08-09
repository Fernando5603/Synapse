import { afterEach, describe, expect, it, vi } from "vitest";
import type { Proposal } from "@synapse/graph-core";
import { createMirror } from "./mirror";
import { createPipeline, percentile95 } from "./pipeline";
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

function makePipeline(overrides: Partial<Parameters<typeof createPipeline>[0]> = {}) {
  return createPipeline({
    extractor: failingExtractor(),
    mirror: createMirror(),
    debounceMs: 3000,
    contextSize: 8,
    retries: 1,
    deliver: async () => {},
    signals: {
      onThinking: () => {},
      onSkipped: () => {},
    },
    ...overrides,
  });
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

  it("estampa el autor del turno en los nodos de la propuesta", async () => {
    vi.useFakeTimers();
    const extractor = {
      extract: async () => ({ nodes: [{ type: "Claim", name: "El modelo gratis basta" }], edges: [] }),
    };
    const mirror = createMirror();
    const seen: { proposal: Proposal; authorId: string | undefined }[] = [];
    const pipeline = createPipeline({
      extractor,
      mirror,
      debounceMs: 3000,
      contextSize: 8,
      retries: 1,
      deliver: async (_room, proposal, authorId) => {
        seen.push({ proposal, authorId });
      },
    });

    await pipeline.onMessage(event(), 1000);
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.resolve();

    expect(seen).toHaveLength(1);
    expect(seen[0]!.authorId).toBe("u_1");
    expect(seen[0]!.proposal.nodes[0]).toMatchObject({ proposedBy: "u_1" });
  });
});

describe("las señales del agente", () => {
  it("avisa que está pensando cuando el lote empieza a extraerse", async () => {
    vi.useFakeTimers();
    const thinking: string[] = [];
    const pipeline = makePipeline({
      extractor: { extract: async () => ({ nodes: [], edges: [] }) },
      signals: { onThinking: (roomId) => thinking.push(roomId) },
    });

    await pipeline.onMessage(event(), 1000);
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.resolve();

    expect(thinking).toEqual(["demo"]);
  });

  it("avisa que se saltó un turno cuando el lote se descarta", async () => {
    vi.useFakeTimers();
    const skipped: string[] = [];
    const pipeline = makePipeline({
      signals: { onSkipped: (roomId) => skipped.push(roomId) },
    });

    await pipeline.onMessage(event(), 1000);
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.resolve();

    expect(skipped).toEqual(["demo"]);
  });

  it("no avisa que se saltó un turno cuando el lote se entregó", async () => {
    vi.useFakeTimers();
    const skipped: string[] = [];
    const pipeline = makePipeline({
      extractor: { extract: async () => ({ nodes: [], edges: [] }) },
      signals: { onSkipped: (roomId) => skipped.push(roomId) },
    });

    await pipeline.onMessage(event(), 1000);
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.resolve();

    expect(skipped).toHaveLength(0);
  });
});

describe("el reporte del criterio (a)", () => {
  it("cuenta un lote descartado por el LLM", async () => {
    vi.useFakeTimers();
    const pipeline = makePipeline({});

    await pipeline.onMessage(event(), 1000);
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.resolve();

    expect(pipeline.report().skipped).toBe(1);
    expect(pipeline.report().completed).toBe(0);
  });

  it("cuenta un lote completado", async () => {
    vi.useFakeTimers();
    const pipeline = makePipeline({
      extractor: { extract: async () => ({ nodes: [], edges: [] }) },
    });

    await pipeline.onMessage(event(), 1000);
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.resolve();

    expect(pipeline.report().completed).toBe(1);
    expect(pipeline.report().skipped).toBe(0);
  });

  it("cuenta el arrastre como un lote descartado en la primera ronda", async () => {
    vi.useFakeTimers();
    let extract: () => Promise<Proposal | undefined> = async () => undefined;
    const pipeline = makePipeline({
      extractor: { extract: () => extract() },
    });

    await pipeline.onMessage(event(), 1000);
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.resolve();
    expect(pipeline.report().skipped).toBe(1);

    extract = async () => ({ nodes: [], edges: [] });
    await pipeline.onMessage(event({ id: "m_2" }), 5000);
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.resolve();
    expect(pipeline.report().completed).toBe(1);
  });
});

describe("el p95 del criterio (a)", () => {
  it("es el valor en el percentil 95 de las latencias", () => {
    const latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    // 10 valores, índice ceil(9.5)-1 = 9 → el último (1000).
    expect(percentile95(latencies)).toBe(1000);
  });

  it("es undefined sin ninguna latencia", () => {
    expect(percentile95([])).toBeUndefined();
  });

  it("con pocos valores toma el mayor", () => {
    expect(percentile95([50, 80])).toBe(80);
  });
});
