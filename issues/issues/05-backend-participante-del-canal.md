# 05 — El backend entra al canal como participante

**What to build:** El mismo nodo del ticket 04, pero disparado desde el servidor en vez de desde la consola del navegador. El backend mantiene un cliente headless conectado por WebSocket como participante de servicio, acuña su token con la publishable key, y hace `send()` de un `graph.proposal` al namespace `graph.`.

Esto es C3.4-B en vivo: el camino que el SDK ya usa para entregar tipos de extensión. El efecto lateral bueno es que el agente pasa a ser un participante del canal y no un servicio empujando desde fuera.

Todavía sin LLM: la propuesta es fija, disparada por un endpoint de prueba.

**Blocked by:** 04.

**Status:** implementado — falta la corrida en el entorno desplegado

- [x] El backend acuña un token anónimo con la publishable key
- [x] Mantiene una conexión WebSocket viva como participante de servicio
- [x] Un `send()` de `graph.proposal` desde el servidor llega a `onBatch` de la extensión
- [ ] El nodo aparece en las tres pestañas, disparado desde el servidor
- [x] La conexión se restablece sola si se cae, sin reiniciar el proceso
- [x] Queda anotado en `spike.md` el desenlace de X1-Q1: si el POST REST al namespace de la extensión funciona (y ahorraría esta conexión) o se descarta

## Cómo se verificó

- **Token y conexión**: el agente entra al canal como `anon_…` y sale en el roster con
  `displayName: "Synapse"`. Visto desde un observador headless independiente
  (`internal/probe-observer.mjs`).
- **`send()` → `onBatch`**: `GET /api/agent/propose?room=<sala>` devuelve el `graph.delta`
  con el que contesta la extensión, y la versión sube 1 → 2 entre disparos seguidos.
- **Reconexión**: proxy TCP local que corta la conexión a voluntad
  (`internal/probe-reconnect.mjs`). El canal se cura solo, `ready → degraded-http → ready`
  en aproximadamente un segundo, sin reiniciar el proceso.
- **X1-Q1**: `internal/probe-rest.mjs`. Desenlace y consecuencias en `spike.md`.

Queda la corrida del criterio 4 con tres pestañas. El equivalente headless —el delta llega a
otro participante del canal, y el agente sale en el roster en vivo— ya pasa.

**No hay entorno desplegado**: Railway no está sirviendo el proyecto ahora mismo. El 04 se
dio por cerrado mirándolo en tres ventanas de incógnito locales contra `npm run dev -w web`,
y ese es el criterio que aplica también aquí. Ojo con el detalle del README: tres pestañas
del mismo perfil son **un solo participante**, porque la identidad anónima es por perfil de
navegador.
