import { describe, expect, it } from "vitest";
import { classifyWebhook } from "./filter";

function published(event: Partial<Parameters<typeof classifyWebhook>[0]> = {}) {
  return {
    id: "m_1",
    type: "message.published",
    channelId: "room-demo",
    data: {
      type: "message",
      content: { text: "hola" },
      sender: { id: "u_1", anon: true },
      ephemeral: false,
    },
    ...event,
  };
}

describe("el filtro de la primera línea del webhook", () => {
  it("acepta un mensaje de chat de la sala como turno", () => {
    const decision = classifyWebhook(published());
    expect(decision.kind).toBe("turn");
    if (decision.kind === "turn") {
      expect(decision).toMatchObject({ roomId: "demo", text: "hola", senderId: "u_1" });
    }
  });

  it("ignora una retracción: no es un turno de conversación", () => {
    expect(
      classifyWebhook(published({ type: "message.retracted" })).kind,
    ).toBe("ignore");
  });

  it("ignora un mensaje del namespace graph.*: no debe realimentar el pipeline", () => {
    expect(
      classifyWebhook(
        published({ data: { type: "graph.delta", content: {}, sender: { id: "ext", anon: true }, ephemeral: false } }),
      ).kind,
    ).toBe("ignore");
    expect(
      classifyWebhook(
        published({ data: { type: "graph.proposal", content: {}, sender: { id: "ext", anon: true }, ephemeral: false } }),
      ).kind,
    ).toBe("ignore");
  });

  it("ignora un mensaje que no es de una sala room-*", () => {
    expect(
      classifyWebhook(published({ channelId: "announcements" })).kind,
    ).toBe("ignore");
  });

  it("ignora un efímero: no hay nada persistido que extraer", () => {
    expect(
      classifyWebhook(
        published({ data: { type: "message", content: { text: "x" }, sender: { id: "u_1", anon: true }, ephemeral: true } }),
      ).kind,
    ).toBe("ignore");
  });

  it("ignora un mensaje sin contenido de texto", () => {
    expect(
      classifyWebhook(
        published({ data: { type: "message", content: { x: 1 }, sender: { id: "u_1", anon: true }, ephemeral: false } }),
      ).kind,
    ).toBe("ignore");
  });
});
