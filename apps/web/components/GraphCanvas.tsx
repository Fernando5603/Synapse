"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { select } from "d3-selection";
// Solo por el efecto: es lo que le añade `.transition()` a una selección de d3-selection.
import "d3-transition";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { Graph, Node } from "@synapse/graph-core";
import { seedPosition } from "@/lib/layout";
import { degrees, neighborhood, nodeRadius } from "@/lib/graphView";
import { ENTITY_PAINT, RELATION_PAINT } from "@/lib/palette";
import type { RemoteCursor } from "@/lib/cursor";
import CursorLayer from "./CursorLayer";
import { Button } from "./ui/button";

/**
 * El lienzo del grafo.
 *
 * La simulación es de `d3-force`, pero **anclada** a la siembra determinista de
 * `seedPosition`: cada nodo tiene un `forceX`/`forceY` flojo tirando de él hacia la
 * posición que su `id` decide. Es lo que reconcilia las dos cosas que se piden a la vez —
 * que el layout se ordene solo (aristas de longitud pareja, nada encima de nada) y que las
 * tres pantallas vean aproximadamente lo mismo aunque una haya recibido el grafo entero de
 * golpe y otra nodo a nodo. Sin el ancla, el layout dependería del orden de llegada.
 *
 * El arrastre sigue siendo puramente local y no se sincroniza (decisión del spec).
 */

/** El área lógica donde se siembran los nodos; el zoom decide cuánto de ella se ve. */
const WORLD = { width: 1200, height: 820 };

/** Cuánto dura el "recién llegado" de un nodo: el anillo que late y el crecimiento. */
const ARRIVAL_MS = 2200;

interface SimNode extends SimulationNodeDatum {
  id: string;
  type: Node["type"];
  name: string;
  radius: number;
  /** El ancla determinista: a dónde tira el nodo cuando nadie lo empuja. */
  seedX: number;
  seedY: number;
  /** Cuándo apareció, para animar su entrada. `0` = estaba desde el principio. */
  bornAt: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  type: keyof typeof RELATION_PAINT;
  bornAt: number;
}

export default function GraphCanvas({
  graph,
  remoteCursors = [],
  onCursorMove,
  focusNodeId = null,
}: {
  graph: Graph;
  remoteCursors?: readonly RemoteCursor[];
  onCursorMove?: (x: number, y: number) => void;
  focusNodeId?: string | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(() => zoomIdentity);

  // Los nodos y aristas de la simulación viven en refs porque D3 los muta en cada tick;
  // el estado de React solo lleva un contador que dispara el repintado.
  const nodesRef = useRef<Map<string, SimNode>>(new Map());
  const linksRef = useRef<SimLink[]>([]);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const [, setTick] = useState(0);

  const [hovered, setHovered] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const degreeOf = useMemo(() => degrees(graph), [graph]);

  // ── La simulación se reconcilia con el grafo, no se reconstruye ────────────────────
  // Reconstruirla en cada delta reiniciaría el layout entero y los nodos que ya estaban
  // saltarían de sitio en cada mensaje. Aquí solo entran los nuevos.
  useEffect(() => {
    const now = performance.now();
    const nodes = nodesRef.current;
    let structureChanged = false;

    for (const node of graph.nodes) {
      const seed = seedPosition(node.id, WORLD);
      const existing = nodes.get(node.id);
      if (existing === undefined) {
        nodes.set(node.id, {
          id: node.id,
          type: node.type,
          name: node.name,
          radius: nodeRadius(degreeOf.get(node.id) ?? 0),
          seedX: seed.x,
          seedY: seed.y,
          // Nace en su semilla: la entrada anima desde donde le toca, no desde el centro.
          x: seed.x,
          y: seed.y,
          bornAt: now,
        });
        structureChanged = true;
      } else {
        // El grado puede subir sin que el nodo sea nuevo: una arista nueva lo engorda.
        const radius = nodeRadius(degreeOf.get(node.id) ?? 0);
        if (radius !== existing.radius) {
          existing.radius = radius;
          structureChanged = true;
        }
      }
    }

    const known = new Set(linksRef.current.map((link) => link.id));
    for (const edge of graph.edges) {
      if (known.has(edge.id)) {
        continue;
      }
      const source = nodes.get(edge.from);
      const target = nodes.get(edge.to);
      if (source === undefined || target === undefined) {
        continue;
      }
      linksRef.current.push({ id: edge.id, type: edge.type, source, target, bornAt: now });
      structureChanged = true;
    }

    if (!structureChanged) {
      return;
    }

    const list = [...nodes.values()];
    let simulation = simRef.current;
    if (simulation === null) {
      simulation = forceSimulation<SimNode, SimLink>(list)
        .force("charge", forceManyBody<SimNode>().strength(-260).distanceMax(420))
        .force(
          "link",
          forceLink<SimNode, SimLink>([])
            .id((node) => node.id)
            .distance(130)
            .strength(0.35),
        )
        .force(
          "collide",
          forceCollide<SimNode>().radius((node) => node.radius + 26).strength(0.9),
        )
        // El ancla determinista. Flojo a propósito: ordena sin congelar.
        .force("anchorX", forceX<SimNode>((node) => node.seedX).strength(0.06))
        .force("anchorY", forceY<SimNode>((node) => node.seedY).strength(0.06))
        .alphaDecay(0.035)
        .on("tick", () => setTick((n) => n + 1));
      simRef.current = simulation;
    } else {
      simulation.nodes(list);
    }

    const link = simulation.force("link") as ReturnType<typeof forceLink<SimNode, SimLink>>;
    link.links(linksRef.current);
    // Recalentar, no reiniciar: el layout se reacomoda alrededor de lo que ya había.
    simulation.alpha(0.7).restart();
  }, [graph, degreeOf]);

  useEffect(() => {
    return () => {
      simRef.current?.stop();
    };
  }, []);

  // ── Zoom y paneo ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (svg === null) {
      return;
    }
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 2.5])
      // Un arrastre que empieza sobre un nodo lo mueve a él, no a la cámara.
      .filter((event: Event) => {
        const target = event.target as Element | null;
        return target?.closest("[data-node]") === null || event.type === "wheel";
      })
      .on("zoom", (event: { transform: ZoomTransform }) => setTransform(event.transform));
    zoomRef.current = behavior;
    select(svg).call(behavior).on("dblclick.zoom", null);
    return () => {
      select(svg).on(".zoom", null);
    };
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (svg === null || behavior === null) {
      return;
    }
    select(svg).transition().duration(220).call(behavior.scaleBy, factor);
  }, []);

  const resetView = useCallback(() => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (svg === null || behavior === null) {
      return;
    }
    select(svg).transition().duration(420).call(behavior.transform, zoomIdentity);
  }, []);

  // El aviso de contradicción centra la cámara en el nodo señalado y lo marca. Solo
  // reacciona a un `focusNodeId` nuevo: un tick de la simulación no vuelve a saltar.
  const lastFocusRef = useRef<string | null>(null);
  useEffect(() => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (focusNodeId === null || lastFocusRef.current === focusNodeId || svg === null || behavior === null) {
      return;
    }
    const node = nodesRef.current.get(focusNodeId);
    if (node?.x === undefined || node.y === undefined) {
      return;
    }
    lastFocusRef.current = focusNodeId;
    const rect = svg.getBoundingClientRect();
    select(svg)
      .transition()
      .duration(650)
      .call(
        behavior.transform,
        zoomIdentity
          .translate(rect.width / 2, rect.height / 2)
          .scale(1.15)
          .translate(-node.x, -node.y),
      );
    setHighlighted(focusNodeId);
    const timer = setTimeout(() => setHighlighted(null), 3200);
    return () => clearTimeout(timer);
  }, [focusNodeId]);

  // ── Arrastre de un nodo (local, nunca sincronizado) ────────────────────────────────
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);

  function toWorld(event: React.PointerEvent<SVGSVGElement>): { x: number; y: number } {
    const rect = event.currentTarget.getBoundingClientRect();
    const [x, y] = transform.invert([event.clientX - rect.left, event.clientY - rect.top]);
    return { x, y };
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const world = toWorld(event);
    // El cursor viaja en coordenadas del mundo: así "estoy señalando este nodo" significa
    // lo mismo en las tres pantallas aunque cada una tenga su propio zoom y paneo.
    onCursorMove?.(world.x, world.y);

    const drag = dragRef.current;
    if (drag === null) {
      return;
    }
    const node = nodesRef.current.get(drag.id);
    if (node === undefined) {
      return;
    }
    node.fx = world.x;
    node.fy = world.y;
    simRef.current?.alphaTarget(0.28).restart();
  }

  function endDrag() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag === null) {
      return;
    }
    const node = nodesRef.current.get(drag.id);
    if (node !== undefined) {
      // Soltar libera el nodo: vuelve a negociar su sitio con sus vecinos y con su ancla.
      node.fx = null;
      node.fy = null;
    }
    simRef.current?.alphaTarget(0);
  }

  const near = hovered === null ? null : neighborhood(graph, hovered);
  const nodes = [...nodesRef.current.values()];
  const now = typeof performance === "undefined" ? 0 : performance.now();

  return (
    <section className="canvas-grid relative flex-1 overflow-hidden">
      <svg
        ref={svgRef}
        className="h-full w-full touch-none select-none"
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        <defs>
          {/* El halo de los nodos: un desenfoque barato que da la sensación de luz. */}
          <filter id="node-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {Object.entries(RELATION_PAINT).map(([type, paint]) => (
            <marker
              key={type}
              id={`arrow-${type}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={paint.stroke} opacity={0.75} />
            </marker>
          ))}
        </defs>

        <g transform={transform.toString()}>
          {/* Aristas primero: siempre por debajo de los nodos. */}
          {linksRef.current.map((link) => {
            const source = link.source as SimNode;
            const target = link.target as SimNode;
            if (source.x === undefined || target.x === undefined) {
              return null;
            }
            const paint = RELATION_PAINT[link.type];
            const dim = near !== null && !(near.has(source.id) && near.has(target.id));
            const arriving = now - link.bornAt < ARRIVAL_MS;
            return (
              <g key={link.id} opacity={dim ? 0.12 : 1} className="transition-opacity duration-300">
                <line
                  x1={source.x}
                  y1={source.y ?? 0}
                  x2={target.x}
                  y2={target.y ?? 0}
                  stroke={paint.stroke}
                  strokeWidth={link.type === "SUPPORTS" || link.type === "CONTRADICTS" ? 2.2 : 1.4}
                  strokeOpacity={0.75}
                  strokeDasharray={paint.dashed ? "5 6" : undefined}
                  markerEnd={`url(#arrow-${link.type})`}
                />
                {arriving && (
                  // El destello que recorre la arista al nacer: dice "esto acaba de pasar".
                  <line
                    x1={source.x}
                    y1={source.y ?? 0}
                    x2={target.x}
                    y2={target.y ?? 0}
                    stroke={paint.stroke}
                    strokeWidth={5}
                    strokeOpacity={0.35}
                    className="animate-pulse"
                  />
                )}
              </g>
            );
          })}

          {nodes.map((node) => {
            if (node.x === undefined || node.y === undefined) {
              return null;
            }
            const paint = ENTITY_PAINT[node.type];
            const dim = near !== null && !near.has(node.id);
            const age = now - node.bornAt;
            const arriving = age < ARRIVAL_MS;
            // Sobresalto de entrada: el nodo llega grande y se asienta.
            const scale = arriving ? 1 + 0.35 * Math.exp(-age / 300) : 1;
            const isHovered = hovered === node.id;
            const radius = node.radius * (isHovered ? 1.12 : 1) * scale;

            return (
              <g
                key={node.id}
                data-node={node.id}
                transform={`translate(${node.x} ${node.y})`}
                opacity={dim ? 0.18 : 1}
                className="cursor-grab transition-opacity duration-300 active:cursor-grabbing"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  dragRef.current = { id: node.id, pointerId: event.pointerId };
                  (event.currentTarget as SVGGElement).setPointerCapture(event.pointerId);
                }}
                onPointerEnter={() => setHovered(node.id)}
                onPointerLeave={() => setHovered((current) => (current === node.id ? null : current))}
              >
                {(arriving || highlighted === node.id) && (
                  <circle
                    r={radius + 6}
                    fill="none"
                    stroke={highlighted === node.id ? "#fbbf24" : paint.fill}
                    strokeWidth={2}
                    className="animate-pulse-ring origin-center"
                  />
                )}
                <circle r={radius + 10} fill={paint.glow} filter="url(#node-glow)" />
                <circle
                  r={radius}
                  fill={paint.fill}
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={isHovered ? 2 : 1}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.round(radius * 0.8)}
                  fontWeight={700}
                  fill="rgba(10,10,20,0.75)"
                  pointerEvents="none"
                >
                  {paint.initial}
                </text>
                <text
                  textAnchor="middle"
                  y={radius + 16}
                  fontSize={12}
                  fill="#e6e6f0"
                  pointerEvents="none"
                  style={{ paintOrder: "stroke", stroke: "rgba(10,10,20,0.85)", strokeWidth: 3.5 }}
                >
                  {truncate(node.name)}
                </text>
              </g>
            );
          })}

          <CursorLayer cursors={remoteCursors} scale={transform.k} />
        </g>
      </svg>

      <Legend />

      <div className="absolute right-4 top-4 flex flex-col gap-1 rounded-lg border border-border glass p-1">
        <Button variant="ghost" size="icon" onClick={() => zoomBy(1.3)} title="Acercar">
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => zoomBy(1 / 1.3)} title="Alejar">
          <Minus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={resetView} title="Encuadrar">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {graph.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
          <div className="animate-float text-5xl opacity-40">◌</div>
          <p className="text-sm text-muted-foreground">
            El grafo está vacío. Empezad a hablar y los nodos aparecen solos.
          </p>
        </div>
      )}
    </section>
  );
}

/** Un nombre largo tapa a sus vecinos; el nodo entero sigue en el tooltip del roster. */
function truncate(name: string): string {
  return name.length > 26 ? `${name.slice(0, 25)}…` : name;
}

function Legend() {
  return (
    <div className="absolute bottom-4 left-4 flex flex-wrap gap-x-3 gap-y-1.5 rounded-lg border border-border glass px-3 py-2">
      {Object.entries(ENTITY_PAINT).map(([type, paint]) => (
        <span key={type} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: paint.fill, boxShadow: `0 0 8px ${paint.fill}` }}
          />
          {paint.label}
        </span>
      ))}
    </div>
  );
}
