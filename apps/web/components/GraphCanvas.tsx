"use client";

import { useEffect, useRef, useState } from "react";
import type { EntityType, Graph, RelationType } from "@synapse/graph-core";
import {
  relaxNeighbors,
  seedPosition,
  type Position,
  type Positions,
} from "@/lib/layout";
import type { RemoteCursor } from "@/lib/cursor";

const VIEW_BOUNDS = { width: 840, height: 600 };

const NODE_COLORS: Record<EntityType, string> = {
  Claim: "#4f6ef7",
  Concept: "#2fbf71",
  Question: "#f7a83e",
  Evidence: "#8b5cf6",
  Person: "#e05780",
  Decision: "#14b8a6",
};

const EDGE_COLORS: Record<RelationType, string> = {
  SUPPORTS: "#2fbf71",
  CONTRADICTS: "#d90429",
  ELABORATES: "#94a3b8",
  ANSWERS: "#94a3b8",
  PROPOSED_BY: "#94a3b8",
  RESOLVES: "#94a3b8",
};

const NODE_LABEL: Record<EntityType, string> = {
  Claim: "C",
  Concept: "K",
  Question: "?",
  Evidence: "E",
  Person: "P",
  Decision: "D",
};

export default function GraphCanvas({
  graph,
  remoteCursors = [],
  onCursorMove,
}: {
  graph: Graph;
  remoteCursors?: readonly RemoteCursor[];
  onCursorMove?: (x: number, y: number) => void;
}) {
  const [positions, setPositions] = useState<Positions>(() => new Map());
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  function cursorCoords(
    event: React.PointerEvent<SVGSVGElement>,
  ): { x: number; y: number } {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (VIEW_BOUNDS.width / rect.width),
      y: (event.clientY - rect.top) * (VIEW_BOUNDS.height / rect.height),
    };
  }

  // Siembra determinista: solo los nodos nuevos reciben posición. Como la
  // posición es función pura del `id`, un nodo aparece en el mismo sitio en las
  // tres pantallas y su llegada no toca a los que ya estaban.
  useEffect(() => {
    setPositions((previous) => {
      const newIds = new Set<string>();
      for (const node of graph.nodes) {
        if (!previous.has(node.id)) {
          newIds.add(node.id);
        }
      }
      if (newIds.size === 0) {
        return previous;
      }
      const next = new Map(previous);
      for (const id of newIds) {
        next.set(id, seedPosition(id, VIEW_BOUNDS));
      }
      return next;
    });
  }, [graph]);

  return (
    <section
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        background: "#fafafa",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW_BOUNDS.width} ${VIEW_BOUNDS.height}`}
        onPointerMove={(event) => {
          const coords = cursorCoords(event);
          onCursorMove?.(coords.x, coords.y);
          const drag = dragRef.current;
          if (drag === null) {
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          const x =
            (event.clientX - rect.left) * (VIEW_BOUNDS.width / rect.width) -
            drag.offsetX;
          const y =
            (event.clientY - rect.top) * (VIEW_BOUNDS.height / rect.height) -
            drag.offsetY;
          setPositions((previous) => {
            const current = previous.get(drag.id);
            if (current === undefined || (current.x === x && current.y === y)) {
              return previous;
            }
            const next = new Map(previous);
            next.set(drag.id, { x, y });
            return next;
          });
        }}
        onPointerUp={() => {
          const drag = dragRef.current;
          dragRef.current = null;
          if (drag !== null) {
            setPositions((previous) => relaxNeighbors(graph, previous, drag.id));
          }
        }}
      >
        {graph.edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (from === undefined || to === undefined) {
            return null;
          }
          return (
            <line
              key={edge.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={EDGE_COLORS[edge.type]}
              strokeWidth={2}
            />
          );
        })}
        {graph.nodes.map((node) => {
          const position = positions.get(node.id);
          if (position === undefined) {
            return null;
          }
          return (
            <g
              key={node.id}
              transform={`translate(${position.x} ${position.y})`}
              style={{ cursor: "grab" }}
              onPointerDown={(event) => {
                const target = event.currentTarget as SVGGElement;
                const svg = target.ownerSVGElement!;
                const rect = svg.getBoundingClientRect();
                dragRef.current = {
                  id: node.id,
                  offsetX:
                    event.clientX -
                    rect.left -
                    position.x * (rect.width / VIEW_BOUNDS.width),
                  offsetY:
                    event.clientY -
                    rect.top -
                    position.y * (rect.height / VIEW_BOUNDS.height),
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
            >
              <circle r={26} fill={NODE_COLORS[node.type]} opacity={0.15} />
              <circle r={18} fill={NODE_COLORS[node.type]} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                y={-34}
                fontSize={11}
                fill="#333"
              >
                {node.name}
              </text>
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fill="#fff"
                fontWeight="bold"
              >
                {NODE_LABEL[node.type]}
              </text>
            </g>
          );
        })}
        {remoteCursors.map((cursor) => (
          <g
            key={cursor.id}
            transform={`translate(${cursor.x} ${cursor.y})`}
            pointerEvents="none"
          >
            <path
              d="M 0 0 L 0 18 L 5 13 L 9 20 L 13 18 L 9 11 L 16 10 Z"
              fill="#333"
              opacity={0.9}
            />
            <text x={4} y={-6} fontSize={11} fill="#333" fontWeight="600">
              {cursor.displayName}
            </text>
          </g>
        ))}
      </svg>
      <Legend />
    </section>
  );
}

function Legend() {
  return (
    <div style={{ position: "absolute", bottom: 12, left: 12, fontSize: 12 }}>
      {Object.entries(NODE_LABEL).map(([type, label]) => (
        <span key={type} style={{ marginRight: 12, color: "#555" }}>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: 5,
              background: NODE_COLORS[type as EntityType],
              marginRight: 4,
            }}
          />
          {label} · {type}
        </span>
      ))}
    </div>
  );
}
