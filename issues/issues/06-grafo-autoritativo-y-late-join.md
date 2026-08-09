# 06 — Grafo autoritativo: merge real, `ctx.storage` y late-join

**What to build:** La extensión deja de mentir. En vez de devolver un delta fijo, llama a `mergeProposal` de `graph-core`, persiste el resultado y sirve el grafo entero a quien llega tarde.

Esto es lo que convierte la extensión en la fuente de verdad del sistema, que es el argumento central frente al jurado (R5): el estado no vive en el backend ni en una base de datos, vive en un primitivo de Portal.

El late-join se resuelve con `onSnapshot` en la trama de conexión — no hay replay del historial ni backfill de deltas.

**Blocked by:** 01 (`mergeProposal`), 04 (extensión desplegada).

**Status:** implementado — ya no falta la corrida en tres ventanas

- [x] `onBatch` llama a `mergeProposal` de `graph-core` en vez de devolver un delta fijo
- [x] Dos propuestas del mismo concepto con distinta grafía producen un solo nodo en el grafo compartido
- [x] El grafo se persiste en `ctx.storage` tras cada merge
- [x] `onInit` rehidrata desde `ctx.storage`: forzar un reciclaje de instancia no pierde el grafo
- [x] `onSnapshot` entrega el grafo completo en la trama de conexión
- [x] Una pestaña abierta a mitad de sesión pinta el grafo entero de inmediato
- [x] La versión del grafo es la que sirve la extensión, y las tres pantallas coinciden en ella
- [x] Queda anotado en `spike.md` qué se rehidrató solo desde `ctx.storage` y qué hubo que reconstruir a mano (X1-Q6)

## Cómo se verificó

Todo contra la extensión desplegada, con `internal/probe-graph06.mjs` (una corrida hace las
cuatro cosas) y con el endpoint del agente contra `npm run dev -w web`.

- **Merge real**: la propuesta «Base de datos / SQL es relacional» devuelve
  `concept-bas-de-dato` y `claim-sql-es-relacional` — los ids que acuña `mergeProposal`,
  no el delta fijo del 04.
- **Dedupe**: «las bases de datos» y «el SQL es relacional» sobre el grafo que ya tenía
  «Base de datos» y «SQL es relacional» dan un delta con **+1 nodo** (solo el nuevo) y la
  arista repetida tampoco entra. Con propuestas a medida por el endpoint,
  «LA LATENCIA» y «las latencias» en la **misma** propuesta dan un solo nodo, y la arista
  que refiere a la segunda grafía resuelve al nodo de la primera.
- **Persistencia y reciclaje**: 50 s de espera entre dos propuestas, con un cliente
  conectado todo el rato. La instancia que contesta la segunda reporta `batches: 1`
  —solo ha visto ese batch, o sea que es nueva— y `rehydrated: true`, y el grafo sigue
  entero con la versión donde estaba. Volviendo a la misma sala minutos después de que se
  fueran todos, las mismas propuestas dan **+0 nodos**: el dedupe corre contra el grafo
  persistido. Detalle campo a campo en `spike.md`, X1-Q6.
- **Late-join**: un segundo cliente que entra a mitad de sesión recibe el grafo entero en
  su trama de conexión (`ext.graph`), sin replay ni backfill. Y **converge**: sigue
  aplicando los deltas siguientes sobre el snapshot y acaba en el mismo número de nodos y
  la misma versión que sirve la extensión.
- **Delta vacío**: dos disparos seguidos del endpoint sobre la misma sala devuelven el
  segundo con `addedNodes: []` y la versión incrementada, y el agente lo toma como acuse
  (`ok: true`, `attempts: 1`). Es lo que evita que el reenvío del 05 se dispare solo.
- **El cliente**: `graphWithSnapshot` en `apps/web/lib/channel.ts`, con tests
  (`npm test`, 81). Cubre que adoptar el snapshot no borre un delta ya pintado y que "no
  hay snapshot" deje la pantalla como estaba en vez de vaciarla.

Quedan los dos criterios que se miran en pantallas. El equivalente headless —dos clientes
independientes, uno de ellos entrando tarde, coincidiendo en el grafo y en la versión— ya
pasa. **No hay entorno desplegado**: Railway no está sirviendo el proyecto, así que la
corrida es en tres ventanas de incógnito locales contra `npm run dev -w web`, como se cerró
el 04. Tres pestañas del mismo perfil son **un solo participante**.
