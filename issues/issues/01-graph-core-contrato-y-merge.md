# 01 — Contrato de datos y núcleo del grafo

**What to build:** El módulo puro `graph-core` con los tipos del grafo y la función de merge. No tiene interfaz: lo que entrega es el contrato que los tres frentes de trabajo importan, y la garantía de que mergear una propuesta hace lo correcto. Es el único seam testeado del proyecto.

Sin un solo import de Portal, `fetch`, `Date` ni Next.js. Lo importan tanto el backend como la extensión, así que no puede depender de ninguno de los dos runtimes.

El contrato (del spec; queda congelado cuando aterrice el ticket 04):

```
Node     = { id, type: EntityType, name, proposedBy?: userId }
Edge     = { id, type: RelationType, from: nodeId, to: nodeId }
Graph    = { nodes: Node[], edges: Edge[], version: number }
Proposal = { nodes: Omit<Node,"id">[], edges: {type, from: name, to: name}[] }
Delta    = { addedNodes: Node[], addedEdges: Edge[], version: number }
```

`EntityType`: `Claim` · `Concept` · `Question` · `Evidence` · `Person` · `Decision`
`RelationType`: `SUPPORTS` · `CONTRADICTS` · `ELABORATES` · `ANSWERS` · `PROPOSED_BY` · `RESOLVES`

Una `Proposal` refiere a los nodos por **nombre**, no por id — el LLM no conoce ids. Resolver nombre→id es trabajo de `mergeProposal`.

`detectContradiction` y `renderDocument` llegan en los tickets 11 y 12. No adelantarlos aquí.

**Blocked by:** Ninguno — se puede empezar de inmediato.

**Status:** done

- [x] `mergeProposal(graph, proposal)` devuelve grafo nuevo y delta, sin mutar la entrada
- [x] Dos propuestas del mismo concepto con distinta grafía (mayúsculas, tildes, plural, artículo) producen un solo nodo
- [x] Reaplicar una propuesta ya mergeada no añade nada
- [x] Una propuesta sin novedad produce un delta vacío **con la versión incrementada** — es lo que sostiene el criterio (a) de `goal.md`
- [x] La versión crece de forma monótona y el delta siempre la reporta
- [x] Una arista cuyos extremos se refieren por nombre se resuelve contra nodos existentes en vez de duplicarlos
- [x] Existe un test que fija qué ocurre con una arista hacia un nombre que no existe — la regla elegida es **descartar la arista**
- [x] Los tests nombran reglas de negocio, no funciones internas: ninguno menciona la normalización de nombres por su nombre de función
- [x] El módulo no importa nada de Portal, Next.js, `fetch` ni `Date`
