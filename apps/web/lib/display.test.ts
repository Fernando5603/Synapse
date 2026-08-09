import { describe, expect, it } from "vitest";
import {
  buildRoster,
  resolveDisplayName,
  typingNames,
  type Me,
  type Participant,
} from "./display";

const me: Me = { id: "me-1", anon: true };

function participant(
  id: string,
  overrides: Partial<Participant> = {},
): Participant {
  return { id, anon: true, ...overrides };
}

describe("el nombre que muestra cada mensaje", () => {
  it("una persona con nombre en su metadata se muestra por ese nombre", () => {
    const sender = { id: "p-1", anon: true };
    const participants = [participant("p-1", { metadata: { displayName: "Ana" } })];

    expect(resolveDisplayName(sender, me, participants)).toBe("Ana");
  });

  it("una persona sin metadata se muestra por su username de broadcast", () => {
    const sender = { id: "p-1", anon: true };
    const participants = [participant("p-1", { username: "rodrigo" })];

    expect(resolveDisplayName(sender, me, participants)).toBe("rodrigo");
  });

  it("una persona sin nombre propio cae a un identificador anónimo estable", () => {
    const sender = { id: "p-abc123", anon: true };
    const participants = [participant("p-abc123")];

    expect(resolveDisplayName(sender, me, participants)).toBe("anon-p-ab");
  });

  it("mi propio id se muestra con mi nombre, no como anónimo", () => {
    const participants = [participant("me-1", { metadata: { displayName: "Yo" } })];

    expect(resolveDisplayName(me, me, participants)).toBe("Yo");
  });

  it("una persona que ya no está en la sala conserva un nombre estable por su id", () => {
    const sender = { id: "p-xyz987", anon: true };

    expect(resolveDisplayName(sender, me, [])).toBe("anon-p-xy");
  });

  it("un autor que salió conserva su nombre si la sala lo recuerda", () => {
    const sender = { id: "p-1", anon: true };
    const knownNames = new Map<string, string>([["p-1", "Ana"]]);

    expect(resolveDisplayName(sender, me, [], knownNames)).toBe("Ana");
  });

  it("antes de conocer mi identidad ningún mensaje se atribuye a mí", () => {
    const sender = { id: "me-1", anon: true };
    const participants: Participant[] = [];

    expect(resolveDisplayName(sender, undefined, participants)).toBe("anon-me-1");
  });
});

describe("el roster de la sala", () => {
  it("me pone delante y ordena al resto alfabéticamente por nombre", () => {
    const participants = [
      participant("p-2", { metadata: { displayName: "Bruno" } }),
      participant("p-3", { metadata: { displayName: "Ana" } }),
      participant("me-1", { metadata: { displayName: "Carla" } }),
    ];

    const roster = buildRoster(me, participants);

    expect(roster.map((row) => row.id)).toEqual(["me-1", "p-3", "p-2"]);
    expect(roster.find((row) => row.id === "me-1")!.isMe).toBe(true);
  });

  it("solo incluye a quienes están en la sala", () => {
    const participants = [participant("p-2", { metadata: { displayName: "Ana" } })];

    const roster = buildRoster(me, participants);

    expect(roster.map((row) => row.id)).toEqual(["me-1", "p-2"]);
  });
});

describe("quiénes están escribiendo", () => {
  it("nombra a los que escriben y excluye a mí", () => {
    const participants = [
      participant("me-1", { metadata: { displayName: "Yo" } }),
      participant("p-2", { metadata: { displayName: "Ana" } }),
      participant("p-3", { metadata: { displayName: "Bruno" } }),
    ];

    expect(typingNames(["p-2", "me-1"], me, participants)).toEqual(["Ana"]);
  });

  it("devuelve lista vacía cuando nadie escribe", () => {
    expect(typingNames([], me, [])).toEqual([]);
  });

  it("un usuario que no está en el roster conserva un nombre estable", () => {
    expect(typingNames(["p-xyz987"], me, [])).toEqual(["anon-p-xy"]);
  });
});
