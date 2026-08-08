# 07 — Extractor real: webhook, debounce, LLM y lista de nodos

**What to build:** Hablas de verdad y aparecen nodos reales tipados en las tres pantallas. Es el ticket que convierte el prototipo en el producto.

El backend escucha el webhook de mensajes, acumula turnos, espera 3 s tras el último, construye un prompt con la ventana de los últimos 8 turnos **y la lista completa de nodos existentes**, se lo pasa a un LLM de capa gratuita con structured output, y entrega la propuesta resultante por el camino del ticket 05.

Dos piezas de este ticket son menos obvias de lo que parecen y no se pueden omitir:

- **El filtro de la primera línea.** Desde el ticket 05 el propio backend es un participante del canal, así que sus `graph.proposal` y los `graph.delta` de la extensión vuelven por el mismo webhook. Sin el filtro por namespace y `channelId` en la primera línea del handler, el pipeline se auto-alimenta y el grafo crece solo cuando nadie habla.
- **De dónde sale la lista de nodos.** No la construye el backend acumulando sus propias propuestas: la recibe de los `graph.delta` autoritativos y del `onSnapshot` de su propia conexión. Si se alimenta de sí mismo, el prompt deriva de la verdad y el dedupe de la extensión acaba cargando todo el peso.

> **Nota de tamaño:** es el ticket más cargado del proyecto y está en el camino crítico. Se decidió no partirlo y que naciera con la lista de nodos completa. Si al abordarlo se ve que no cabe en una sesión, el corte natural es dejar el espejo del grafo y la lista de nodos para un ticket aparte, bloqueado por este.

**Blocked by:** 05 (entrega de propuestas), 06 (grafo autoritativo del que sale la lista de nodos).

**Status:** ready-for-agent

- [ ] El route handler recibe `message.published` y **su primera línea** filtra por namespace y `channelId`
- [ ] Con el filtro puesto, los `graph.proposal` del backend y los `graph.delta` de la extensión no realimentan el pipeline
- [ ] Los turnos se acumulan y el lote se cierra 3 s después del último mensaje
- [ ] El prompt lleva la ventana de los últimos 8 turnos
- [ ] El backend alimenta su espejo del grafo con los `graph.delta` autoritativos y el `onSnapshot` de su conexión, nunca con sus propias propuestas
- [ ] El prompt lleva la lista completa de nodos existentes, tomada de ese espejo
- [ ] La salida es structured output con `enum` sobre el esquema cerrado de 6+6 tipos; lo que no encaja se descarta
- [ ] Prompt y esquema en inglés, con guard de idioma para entradas que no lo sean
- [ ] Una conversación real de un minuto produce nodos tipados correctos en las tres pantallas
- [ ] Un mensaje que no aporta estructura produce un delta vacío, no un error ni un silencio
