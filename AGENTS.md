# AGENTS.md — Synapse

Proyecto greenfield: un **lienzo colaborativo con grafo de conocimiento en vivo**, construido sobre Portal (useportal.co) para la sincronización en tiempo real y LLMs de capa gratuita y baja latencia (llama-3.1-8b vía NVIDIA BUILD). El stack es Next.js + una channel extension de Portal + una CLI de evaluación. Hackathon de 3 personas.

## Documentación de origen (fuente de verdad)

| Archivo | Contenido |
|---|---|
| `goal.md` | Criterio de éxito (a)/(b)/(c), verificación y arquitectura decidida |
| `shaping.md` | Requirements (R0–R8), shapes A/B/C, fit check. Shape elegida: **C** con C3.4-B |
| `breadboard.md` | Afordances de la shape C, slices V1–V9, orden de implementación |
| `spike.md` | Unknowns de la superficie server-side de las channel extensions de Portal (X1-Q1…Q6) |
| `spec.md` | Spec listo para agente: user stories, decisiones de implementación y testing |

Cuando cambie una shape en `shaping.md`, hay que rippearlo en `goal.md`.

## Criterio de éxito (goal.md)

- **(a)** Cada mensaje produce un graph-delta —posiblemente vacío— aplicado en todos los clientes en ≤5 s p95. Reportar aparte el % de mensajes con delta no vacío.
- **(b)** El grafo de un guion de ~40 turnos alcanza ≥60% precisión y ≥50% recall en entidades, ≥50% precisión en relaciones, contra un gold anotado a mano y congelado.
- **(c)** Al cerrar la sesión se genera sin intervención manual un markdown con ideas, relaciones y conclusiones.

## Arquitectura (shape C, C3.4-B)

Tres procesos:

- **Cliente Next.js** — sala, chat, canvas, presencia, cursores, documento final.
- **Backend Next.js** — route handler del webhook, buffer de turnos, llamada al LLM, detección de contradicción, generación del documento, y un cliente headless de `@portalsdk/core` conectado por WebSocket (`apps/web/lib/agent.ts`, uno por proceso, colgado de `globalThis` para sobrevivir al hot reload). Entra a la sala como participante y aparece en el roster como «Synapse»; `apps/web/app/api/agent/propose/route.ts` es el disparo manual mientras no haya LLM.
- **Channel extension de Portal (`graph-owner`)** — dueña del grafo autoritativo. Recibe propuestas, mergea, deduplica, versiona, emite `graph.delta` como return de `onBatch` y sirve el grafo completo vía `onSnapshot()` para el late-join. Vive en `extensions/graph-owner.ts`; `portal.config.ts` (raíz) la engancha al canal y `npm run deploy:portal` la sube (necesita `PORTAL_SECRET`).

Sin base de datos: el grafo vive en memoria de la extensión y se persiste en `ctx.storage`. Deploy en Railway (crédito de prueba, sin cold starts).

Medido en el ticket 04: **una instancia de extensión pierde su memoria en menos de 45 s de inactividad** (`spike.md`, X1-Q6). Así que `ctx.storage` no protege del reciclaje del proceso — es la única memoria que hay entre un turno de conversación y el siguiente.

## El seam: `graph-core`

Todo el comportamiento determinista vive en un módulo puro **sin imports de Portal, `fetch`, `Date` ni Next.js**. Compartido por cliente, backend y extensión. Cuatro funciones:

```
mergeProposal(graph, proposal)       -> { graph, delta }
applyDelta(graph, delta)             -> graph
detectContradiction(graph, proposal) -> { targetUserId, claimId } | null
renderDocument(graph)                -> string
```

`applyDelta` es la contraparte de `mergeProposal`: quien mergea produce el delta, quien lo recibe lo aplica. La usan el cliente y el espejo del backend, y es idempotente porque los batches de Portal llegan **al menos una vez**.

Es el seam principal; los demás están listados en Testing.

## Contrato de datos (CONGELADO)

```
Node     = { id, type: EntityType, name, proposedBy?: userId }
Edge     = { id, type: RelationType, from: nodeId, to: nodeId }
Graph    = { nodes: Node[], edges: Edge[], version: number }
Proposal = { nodes: Omit<Node,"id">[], edges: {type, from: name, to: name}[] }
Delta    = { addedNodes: Node[], addedEdges: Edge[], version: number }
```

- `EntityType`: `Claim` · `Concept` · `Question` · `Evidence` · `Person` · `Decision`
- `RelationType`: `SUPPORTS` · `CONTRADICTS` · `ELABORATES` · `ANSWERS` · `PROPOSED_BY` · `RESOLVES`
- Las `Proposal` refieren nodos **por nombre** (el LLM no conoce ids); `mergeProposal` resuelve nombre→id.
- Un `Delta` vacío es válido y se emite con la versión incrementada (sostiene el criterio (a)).

**Congelado desde que aterrizó el ticket 04**, que es donde el delta viajó por primera vez de la extensión a las tres pantallas. A partir de aquí los tres frentes trabajan contra él: cambiarlo requiere **acuerdo de las tres personas**, no una decisión unilateral. Los tipos de mensaje que lo transportan son parte del contrato: `graph.proposal` (hacia la extensión) lleva una `Proposal`, `graph.delta` (de la extensión al canal) lleva un `Delta`.

Reglas de `mergeProposal` fijadas por test (no cambiarlas sin rippear el gold):

- **Normalización bilingüe.** Minúsculas, sin tildes, sin artículos (`el/la/los/las/un/una/unos/unas` y `the/a/an`), singular. El plural de palabra terminada en `-e` colapsa con su singular (`databases` = `database`, `mensajes` = `mensaje`). El **script de evaluación debe usar exactamente este criterio**: es a la vez la clave de dedupe del grafo y el criterio de acierto contra el gold.
- **Los ids son únicos aunque el slug colisione.** `C++` y `C#` dan los dos `concept-c-`; el segundo recibe `concept-c--2`. Invariante que sostiene el late-join del V4: todo nodo que un `Delta` anuncia está en `graph.nodes`.
- **Se descartan** las aristas hacia un nombre inexistente y las de un nodo hacia sí mismo. `proposedBy` lo fija quien propone el nodo primero; una propuesta posterior no lo reescribe.

## Decisiones de implementación clave

- **Filtro por namespace + `channelId` en la primera línea del webhook** (N21). No es higiene: es lo que evita que el backend se auto-alimente con sus propios `graph.delta` y `graph.proposal`.
- **Debounce de 3 s** sobre el buffer de turnos; ventana de contexto de los **últimos 8 turnos**; el prompt lleva la **lista completa de nodos existentes** construida desde los `graph.delta` autoritativos del headless, no desde las propias propuestas del backend.
- **Structured output con `enum`** sobre el esquema cerrado de 6+6 tipos. Prompt y esquema en inglés, con guard de idioma.
- **Política de fallo del LLM**: timeout duro de 8 s, un reintento, descarte del lote si vuelve a fallar. Los turnos del lote descartado se arrastran a la ventana del siguiente. El fallo se comunica con un mensaje efímero, nunca con silencio.
- **Entrega a la extensión (C3.4-B)**: cliente headless `@portalsdk/core` por WS como participante de servicio, en `apps/web/lib/agent.ts`. Token anónimo acuñado con la publishable key vía `POST /v1/tokens/anonymous` (lo hace el propio SDK al no darle `token`); `send()` al namespace `graph.`. El `send()` por WS **no tiene acuse de recibo** y se pierde en silencio si el socket cae, así que el agente espera el `graph.delta` como acuse y reenvía una vez — seguro, porque `mergeProposal` deduplica por nombre. Medido en el 05, con detalle en `spike.md`, X1-Q1: el `POST /v1/channels/{id}/messages` **también** entra en la extensión y sí devuelve acuse; no se usa porque el agente necesita la conexión viva de todos modos para oír los deltas.
- **Contradicción dirigida**: corre en `graph-core` (invocada por el backend sobre su espejo del grafo, antes del merge). Dispara si hay un `CONTRADICTS` hacia un `Claim` con `PROPOSED_BY` hacia el usuario X y X no es el autor del mensaje. Se emite por REST con `to: X`; una regla en `portal.config.ts` lo convierte en inbox.
- **Render**: posición fija al crear el nodo, force-directed solo local contra vecinos, sin re-layout global. Arrastre puramente local, no sincronizado. Aristas `SUPPORTS` verdes / `CONTRADICTS` rojas.
- **Cursores**: `send({ ephemeral: true })` en `pointermove` throttled; `setMetadata()` throttled a 250 ms como fallback de late-join.
- **Documento final**: plantilla determinista (decisiones con cadena de soporte, contradicciones sin resolver, `Question` sin `ANSWERS`). La síntesis por modelo grande se dispara al cerrar y **no bloquea**: el markdown se muestra completo de inmediato y el párrafo se inserta arriba cuando llega.
- **Evaluación**: script CLI `eval.ts --types=<lista>`, matching normalizado por conjuntos (minúsculas, sin tildes, sin artículos, singular), con tipo y sin tipo, cada gold se consume una sola vez. El script de evaluación no es un test: produce un número, no falla el build.

## Decisions abiertas (no bloquean empezar)

- **Antes de V6**: la posición inicial del nodo debe sembrarse de forma determinista desde el `id`, no desde el orden de llegada (si no, tres participantes ven tres layouts distintos y se rompe la historia 29).
- **En V9**: el handler de cierre debe pedir un `onSnapshot` fresco antes de renderizar el documento, en vez de usar el espejo del backend (si el espejo perdió un delta, el documento miente).

## Testing

- **Seam aprobado 1 — `graph-core`** (`packages/graph-core/src/merge.ts`, `src/delta.ts` y `src/document.ts`): tests de comportamiento externo (grafo+propuesta → grafo/delta/markdown), sin servidor, sin Portal, sin red, sin reloj. `renderDocument(graph) -> string` es la plantilla determinista del documento final: decisiones con su cadena de soporte (SUPPORTS/ELABORATES transitivos), contradicciones CONTRADICTS y `Question` sin `ANSWERS`. Los nombres describen la regla de negocio, no el método.
- **Seam aprobado 2 — display-name/roster** (`apps/web/lib/display.ts`): lógica pura de nombres de mensaje y roster sobre datos con forma del SDK (participants, me, sender), sin importar el SDK. Tests de comportamiento con nombres de regla de negocio.
- **Seam aprobado 3 — layout del grafo** (`apps/web/lib/layout.ts`): siembra determinista de posición desde el `id` del nodo (`seedPosition`, función pura: misma posición para el mismo `id` en cualquier pantalla, dentro del lienzo) + relajación estrictamente local (`relaxNeighbors` mueve solo los vecinos inmediatos del nodo ancla hacia la distancia de reposo, sin re-layout global ni historial de llegada). Lógica pura sobre el contrato de `graph-core`, sin importar el SDK.
- **Seam aprobado 4 — cursores en vivo** (`apps/web/lib/cursor.ts`): throttle del envío (`shouldEmitCursor` decide según el último envío), lectura de la última posición desde la metadata de presencia (`cursorFromMetadata`, el fallback del late-join) y fusión de efímeros en vivo con metadata (`mergeRemoteCursors`; el efímero gana). Atribución con `resolveDisplayName`. Lógica pura sobre datos con forma del SDK, sin importar el SDK.
- **No se testea**: la extracción del LLM (se mide contra el gold, criterio (b)); el transporte de Portal/SDK/webhook/extensión desplegada (se verifica en 3 corridas del guion en el entorno desplegado); la política de fallo (se verifica a mano en V5 con el extractor apuntando a una URL muerta); el render, el canvas y la capa de cursores (se verifican mirándolos).

## Orden de construcción (breadboard.md, slices V1–V9)

V1 y V2 son secuenciales y de los tres. A partir de V3 se abre en tres frentes.

| Slice | Demo |
|---|---|
| **V1** Sala viva | "Tres pestañas en Railway, se chatean, se ven en el roster" |
| **V2** Delta falso end-to-end | "Escribo `/spawn` y aparece el mismo nodo en las tres pantallas" |
| **V3** Extractor real | "Hablo de verdad un minuto y aparecen nodos reales tipados" |
| **V4** Grafo autoritativo y late-join | "Entro a mitad de sesión y veo todo. El grafo sobrevive al reciclaje" |
| **V5** Política de fallo del LLM | "URL muerta: la sala sigue viva, lo dice, y el turno reaparece" |
| **V6** Render de exploración | "40 nodos legibles, no saltan, arrastro solo para mí" |
| **V7** Cursores en vivo | "Veo el puntero de los otros dos" |
| **V8** Contradicción → inbox | "Contradigo el Claim de otro y le llega una notificación dirigida" |
| **V9** Cierre: documento + evaluación | "Cierro y sale el markdown; párrafo arriba después. P/R con y sin tipo" |

## Congelaciones

El contrato de datos al terminar V2 · la lista de tipos antes de anotar el gold · el gold al terminar la anotación · feature freeze 3 h antes del deadline. V7 y V8 son los candidatos a caer en el freeze.

## Fuera de alcance (hasta que (a)–(c) estén verdes)

Voz en vivo (ASR NVIDIA BUILD, primer stretch) · edición manual colaborativa del grafo (segundo stretch) · múltiples salas concurrentes. Fuera del proyecto entero: autenticación real, base de datos, re-layout global, sincronización de posiciones arrastradas, historial/time-travel, resolución de contradicciones desde la UI.

## Parar y preguntar

- Si los modelos de capa gratuita no superan el umbral tras 2 iteraciones de prompt/esquema, la decisión entre recortar el esquema o cambiar de proveedor es del equipo.
- Si el español hunde la precisión en la primera corrida, la decisión de cambiar la demo se toma antes de la hora 3.
