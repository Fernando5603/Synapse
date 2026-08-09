import { describe, expect, it } from "vitest";
import {
  cursorFromMetadata,
  cursorsFromActivity,
  decodeCursorActivity,
  encodeCursorActivity,
  mergeRemoteCursors,
  shouldEmitCursor,
  stepTowards,
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

describe("la interpolación del cursor entre muestras de presencia", () => {
  it("avanza una fracción del camino hacia el objetivo", () => {
    expect(stepTowards({ x: 0, y: 0 }, { x: 100, y: 50 }, 0.5)).toEqual({
      x: 50,
      y: 25,
    });
  });

  it("aterriza exactamente en el objetivo cuando ya está encima", () => {
    // Sin esto el bucle perseguiría un residuo que nunca llega a cero.
    expect(stepTowards({ x: 99.9, y: 50.1 }, { x: 100, y: 50 }, 0.5)).toEqual({
      x: 100,
      y: 50,
    });
  });

  it("no se pasa del objetivo", () => {
    const next = stepTowards({ x: 0, y: 0 }, { x: 10, y: 0 }, 0.25);

    expect(next.x).toBeGreaterThan(0);
    expect(next.x).toBeLessThan(10);
  });
});

describe("el cursor viajando por el carril de actividad", () => {
  it("va y vuelve por el mismo sitio", () => {
    expect(decodeCursorActivity(encodeCursorActivity(120, 45))).toEqual({ x: 120, y: 45 });
  });

  it("redondea: medio píxel no lo ve nadie y alarga el mensaje", () => {
    expect(encodeCursorActivity(12.4, 45.6)).toBe("xy|12|46");
  });

  it("no confunde otra actividad con un cursor", () => {
    for (const kind of ["typing", "thinking", "skipped", "xy|", "xy|a|b"]) {
      expect(decodeCursorActivity(kind)).toBeUndefined();
    }
  });

  it("se queda con la última posición de cada uno, no con la primera", () => {
    // Las posiciones viejas siguen vivas hasta que expiran a los 5 s; quedarse con la
    // primera daría un cursor congelado cinco segundos por detrás.
    const activity = [
      { userId: "p-2", kind: encodeCursorActivity(10, 10) },
      { userId: "p-2", kind: encodeCursorActivity(90, 90) },
    ];

    expect(cursorsFromActivity(activity, "me-1").get("p-2")).toEqual({ x: 90, y: 90 });
  });

  it("no me pinta mi propio puntero", () => {
    const activity = [{ userId: "me-1", kind: encodeCursorActivity(10, 10) }];

    expect(cursorsFromActivity(activity, "me-1").size).toBe(0);
  });

  it("ignora la actividad que no es de cursor", () => {
    const activity = [
      { userId: "p-2", kind: "typing" },
      { userId: "p-3", kind: encodeCursorActivity(5, 5) },
    ];

    const positions = cursorsFromActivity(activity, "me-1");

    expect([...positions.keys()]).toEqual(["p-3"]);
  });
});
