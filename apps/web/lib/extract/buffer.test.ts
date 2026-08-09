import { describe, expect, it } from "vitest";
import { batchDue, collectTurn, contextWindow, type Turn } from "./buffer";

function turn(n: number, at: number): Turn {
  return { id: `m_${n}`, text: `turno ${n}`, at };
}

describe("el buffer de turnos", () => {
  it("acumula los turnos en orden de llegada", () => {
    const turns = collectTurn([], turn(1, 1000));
    const after = collectTurn(turns, turn(2, 2000));

    expect(after.map((t) => t.id)).toEqual(["m_1", "m_2"]);
  });

  it("una reentrega del mismo id no duplica el turno", () => {
    const turns = collectTurn([], turn(1, 1000));
    const after = collectTurn(turns, turn(1, 1500));

    expect(after).toHaveLength(1);
  });

  it("el lote se cierra cuando ha pasado el debounce desde el último turno", () => {
    const turns = [turn(1, 1000)];
    expect(batchDue(turns, 4500, 3000)).toBe(true);
    expect(batchDue(turns, 3500, 3000)).toBe(false);
  });

  it("un buffer vacío no tiene lote que cerrar", () => {
    expect(batchDue([], 5000, 3000)).toBe(false);
  });

  it("la ventana de contexto se queda con los últimos N turnos", () => {
    const turns = [turn(1, 1000), turn(2, 2000), turn(3, 3000), turn(4, 4000)];
    const window = contextWindow(turns, 8);
    const narrow = contextWindow(turns, 2);

    expect(window).toHaveLength(4);
    expect(narrow.map((t) => t.id)).toEqual(["m_3", "m_4"]);
  });
});
