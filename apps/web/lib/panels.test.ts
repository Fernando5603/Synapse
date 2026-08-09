import { describe, expect, it } from "vitest";
import { CHAT_WIDTH, clampWidth, widthFromDragX } from "./panels";

describe("el ancho aplicable de un panel", () => {
  const range = { min: 100, max: 300 };

  it("respeta un ancho que está dentro del rango", () => {
    expect(clampWidth(200, range, 150)).toBe(200);
  });

  it("recorta al máximo: arrastrar sin freno no se come el lienzo", () => {
    expect(clampWidth(9000, range, 150)).toBe(300);
  });

  it("recorta al mínimo: el panel nunca desaparece por arrastre", () => {
    expect(clampWidth(-40, range, 150)).toBe(100);
  });

  it("cae al valor por defecto ante algo que no es un ancho", () => {
    // Un `localStorage` de otra versión no puede dejar la pantalla inservible.
    for (const basura of [undefined, null, "340", NaN, Infinity]) {
      expect(clampWidth(basura, range, 150)).toBe(150);
    }
  });
});

describe("el ancho del chat mientras se arrastra su borde", () => {
  it("arrastrar hacia la izquierda ensancha el chat", () => {
    const ancho = widthFromDragX(1000, 1400);
    const másAncho = widthFromDragX(900, 1400);

    expect(másAncho).toBeGreaterThan(ancho);
  });

  it("mide desde el borde derecho de la ventana, que es donde vive el chat", () => {
    expect(widthFromDragX(1000, 1400)).toBe(400);
  });

  it("sigue dentro de los límites por mucho que se pase el puntero", () => {
    expect(widthFromDragX(-500, 1400)).toBe(CHAT_WIDTH.max);
    expect(widthFromDragX(1400, 1400)).toBe(CHAT_WIDTH.min);
  });
});
