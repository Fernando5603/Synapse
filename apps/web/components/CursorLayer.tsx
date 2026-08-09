"use client";

import { useEffect, useRef, useState } from "react";
import { stepTowards, type CursorPosition, type RemoteCursor } from "@/lib/cursor";
import { participantColor } from "@/lib/palette";

/**
 * Los punteros de los demás, en coordenadas del mundo del grafo.
 *
 * Es un componente aparte por una razón de rendimiento concreta: interpola a 60 fps, y si
 * ese estado viviera en el canvas, cada fotograma repintaría también los cuarenta nodos.
 * Aquí solo se repinta esta capa.
 *
 * La interpolación no es adorno. La posición llega por presencia a ~10 Hz —el carril
 * efímero del SDK no entrega nada, ver `lib/cursor.ts`—, y pintar diez muestras por
 * segundo en crudo da un puntero que teletransporta. Acercarse una fracción por fotograma
 * es lo que lo convierte en movimiento.
 */

/** Cuánto del camino restante se recorre por fotograma. Más alto = más brusco. */
const SMOOTHING = 0.2;

export default function CursorLayer({
  cursors,
  scale,
}: {
  cursors: readonly RemoteCursor[];
  /** El zoom actual: el puntero se contra-escala para no crecer con el lienzo. */
  scale: number;
}) {
  const targetsRef = useRef(cursors);
  targetsRef.current = cursors;

  const paintedRef = useRef<Map<string, CursorPosition>>(new Map());
  const [painted, setPainted] = useState<readonly RemoteCursor[]>(cursors);

  useEffect(() => {
    let frame = 0;

    const tick = () => {
      const targets = targetsRef.current;
      const positions = paintedRef.current;
      let moved = false;

      const next = targets.map((target) => {
        const current = positions.get(target.id);
        const position =
          current === undefined
            ? { x: target.x, y: target.y }
            : stepTowards(current, target, SMOOTHING);
        if (current === undefined || position.x !== current.x || position.y !== current.y) {
          moved = true;
        }
        positions.set(target.id, position);
        return { ...target, x: position.x, y: position.y };
      });

      // Quien se fue de la sala deja de ocupar sitio en el mapa de posiciones.
      if (positions.size !== targets.length) {
        const alive = new Set(targets.map((target) => target.id));
        for (const id of [...positions.keys()]) {
          if (!alive.has(id)) {
            positions.delete(id);
            moved = true;
          }
        }
      }

      // Solo se repinta cuando algo se movió: una sala quieta no gasta fotogramas.
      if (moved) {
        setPainted(next);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <g pointerEvents="none">
      {painted.map((cursor) => {
        const color = participantColor(cursor.id);
        return (
          <g
            key={cursor.id}
            transform={`translate(${cursor.x} ${cursor.y}) scale(${1 / scale})`}
          >
            <path
              d="M 0 0 L 0 19 L 5 14 L 9 21 L 13 19 L 9 12 L 17 11 Z"
              fill={color}
              stroke="rgba(10,10,20,0.7)"
              strokeWidth={1}
            />
            <g transform="translate(16 20)">
              <rect
                rx={5}
                width={cursor.displayName.length * 6.6 + 14}
                height={19}
                fill={color}
                opacity={0.95}
              />
              <text
                x={7}
                y={13}
                fontSize={11}
                fontWeight={600}
                fill="rgba(10,10,20,0.9)"
              >
                {cursor.displayName}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}
