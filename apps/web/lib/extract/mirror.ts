import { applyDelta, emptyGraph, type Delta, type Graph } from "@synapse/graph-core";
import { graphWithSnapshot } from "../channel";

/**
 * El espejo del grafo que mantiene el backend para construir el prompt.
 *
 * La lista de nodos que va al prompt **no** la construye el backend acumulando sus
 * propias propuestas: la recibe de los `graph.delta` autoritativos de la extensión y del
 * snapshot de su conexión. Si se alimentara de sí mismo, el prompt derivaría de la verdad
 * y el dedupe de la extensión acabaría haciendo todo el trabajo.
 */export interface GraphMirror {
  get(): Graph;
  applyDelta(delta: Delta): void;
  /** Adopta el snapshot de la conexión (late-join) uniéndolo con lo ya pintado. */
  adoptSnapshot(ext: Record<string, unknown> | undefined): void;
}

export function createMirror(): GraphMirror {
  let graph: Graph = emptyGraph();

  return {
    get(): Graph {
      return graph;
    },
    applyDelta(delta: Delta): void {
      graph = applyDelta(graph, delta);
    },
    adoptSnapshot(ext: Record<string, unknown> | undefined): void {
      graph = graphWithSnapshot(graph, ext);
    },
  };
}
