import { describe, expect, it } from "vitest";
import {
  cursorFromMetadata,
  mergeRemoteCursors,
  shouldEmitCursor,
  type CursorPosition,
} from "./cursor";

describe("el throttle de envío del cursor", () => {
  it("emite la primera vez aunque sea la primera posición", () => {
    expect(shouldEmitCursor(undefined, 1000, 250)).toBe(true);
  });

  it("no emite si no ha pasado el intervalo", () => {
    expect(shouldEmitCursor(1000, 1200, 250)).toBe(false);
  });

  it("emite cuando ha pasado el intervalo", () => {
    expect(shouldEmitCursor(1000, 1300, 250)).toBe(true);
  });
});

describe("la lectura del cursor desde la metadata", () => {
  it("devuelve la posición cuando la metadata la lleva", () => {
    expect(
      cursorFromMetadata({ cursor: { x: 10, y: 20 } }),
    ).toEqual({ x: 10, y: 20 });
  });

  it("devuelve undefined sin metadata", () => {
    expect(cursorFromMetadata(undefined)).toBeUndefined();
  });

  it("devuelve undefined si la metadata no tiene cursor", () => {
    expect(cursorFromMetadata({ displayName: "Ana" })).toBeUndefined();
  });
});

describe("la lista de cursores remotos", () => {
  const me = { id: "me-1", anon: true };
  const noLive = new Map<string, CursorPosition>();

  it("excluye mi propio cursor", () => {
    const participants = [
      { id: "me-1", anon: true, metadata: { cursor: { x: 1, y: 1 } } },
      { id: "p-2", anon: true, metadata: { cursor: { x: 2, y: 2 } } },
    ];

    const cursors = mergeRemoteCursors(me, participants, noLive);

    expect(cursors.map((c) => c.id)).toEqual(["p-2"]);
  });

  it("incluye solo a quienes tienen cursor en la metadata", () => {
    const participants = [
      { id: "p-2", anon: true, metadata: { cursor: { x: 2, y: 2 } } },
      { id: "p-3", anon: true, metadata: { displayName: "Bruno" } },
    ];

    const cursors = mergeRemoteCursors(me, participants, noLive);

    expect(cursors.map((c) => c.id)).toEqual(["p-2"]);
  });

  it("atribuye cada cursor a su participante con su nombre", () => {
    const participants = [
      {
        id: "p-2",
        anon: true,
        metadata: { displayName: "Ana", cursor: { x: 5, y: 6 } },
      },
    ];

    const cursors = mergeRemoteCursors(me, participants, noLive);

    expect(cursors[0]).toMatchObject({
      id: "p-2",
      displayName: "Ana",
      x: 5,
      y: 6,
    });
  });
});

describe("la fusión de cursores en vivo con los de la metadata", () => {
  const me = { id: "me-1", anon: true };

  it("el efímero en vivo gana sobre la metadata para el mismo participante", () => {
    const live = new Map<string, CursorPosition>([
      ["p-2", { x: 100, y: 200 }],
    ]);
    const participants = [
      { id: "p-2", anon: true, metadata: { cursor: { x: 5, y: 6 } } },
    ];

    const cursors = mergeRemoteCursors(me, participants, live);

    expect(cursors[0]).toMatchObject({ id: "p-2", x: 100, y: 200 });
  });

  it("la metadata cubre a quien todavía no ha movido el ratón", () => {
    const live = new Map<string, CursorPosition>();
    const participants = [
      { id: "p-2", anon: true, metadata: { cursor: { x: 5, y: 6 } } },
    ];

    const cursors = mergeRemoteCursors(me, participants, live);

    expect(cursors[0]).toMatchObject({ id: "p-2", x: 5, y: 6 });
  });

  it("no muestra a un participante sin posición en ninguna fuente", () => {
    const live = new Map<string, CursorPosition>();
    const participants = [{ id: "p-2", anon: true }];

    const cursors = mergeRemoteCursors(me, participants, live);

    expect(cursors).toHaveLength(0);
  });

  it("excluye mi propio cursor", () => {
    const live = new Map<string, CursorPosition>([
      ["me-1", { x: 1, y: 1 }],
    ]);
    const participants = [
      { id: "me-1", anon: true, metadata: { cursor: { x: 1, y: 1 } } },
    ];

    const cursors = mergeRemoteCursors(me, participants, live);

    expect(cursors).toHaveLength(0);
  });
});
