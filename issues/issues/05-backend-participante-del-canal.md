# 05 — El backend entra al canal como participante

**What to build:** El mismo nodo del ticket 04, pero disparado desde el servidor en vez de desde la consola del navegador. El backend mantiene un cliente headless conectado por WebSocket como participante de servicio, acuña su token con la publishable key, y hace `send()` de un `graph.proposal` al namespace `graph.`.

Esto es C3.4-B en vivo: el camino que el SDK ya usa para entregar tipos de extensión. El efecto lateral bueno es que el agente pasa a ser un participante del canal y no un servicio empujando desde fuera.

Todavía sin LLM: la propuesta es fija, disparada por un endpoint de prueba.

**Blocked by:** 04.

**Status:** ready-for-agent

- [ ] El backend acuña un token anónimo con la publishable key
- [ ] Mantiene una conexión WebSocket viva como participante de servicio
- [ ] Un `send()` de `graph.proposal` desde el servidor llega a `onBatch` de la extensión
- [ ] El nodo aparece en las tres pestañas, disparado desde el servidor
- [ ] La conexión se restablece sola si se cae, sin reiniciar el proceso
- [ ] Queda anotado en `spike.md` el desenlace de X1-Q1: si el POST REST al namespace de la extensión funciona (y ahorraría esta conexión) o se descarta
