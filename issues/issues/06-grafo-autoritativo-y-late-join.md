# 06 — Grafo autoritativo: merge real, `ctx.storage` y late-join

**What to build:** La extensión deja de mentir. En vez de devolver un delta fijo, llama a `mergeProposal` de `graph-core`, persiste el resultado y sirve el grafo entero a quien llega tarde.

Esto es lo que convierte la extensión en la fuente de verdad del sistema, que es el argumento central frente al jurado (R5): el estado no vive en el backend ni en una base de datos, vive en un primitivo de Portal.

El late-join se resuelve con `onSnapshot` en la trama de conexión — no hay replay del historial ni backfill de deltas.

**Blocked by:** 01 (`mergeProposal`), 04 (extensión desplegada).

**Status:** ready-for-agent

- [ ] `onBatch` llama a `mergeProposal` de `graph-core` en vez de devolver un delta fijo
- [ ] Dos propuestas del mismo concepto con distinta grafía producen un solo nodo en el grafo compartido
- [ ] El grafo se persiste en `ctx.storage` tras cada merge
- [ ] `onInit` rehidrata desde `ctx.storage`: forzar un reciclaje de instancia no pierde el grafo
- [ ] `onSnapshot` entrega el grafo completo en la trama de conexión
- [ ] Una pestaña abierta a mitad de sesión pinta el grafo entero de inmediato
- [ ] La versión del grafo es la que sirve la extensión, y las tres pantallas coinciden en ella
- [ ] Queda anotado en `spike.md` qué se rehidrató solo desde `ctx.storage` y qué hubo que reconstruir a mano (X1-Q6)
