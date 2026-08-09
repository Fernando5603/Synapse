# 08 — Política de fallo del LLM

**What to build:** Que la sala siga viva cuando el modelo gratuito tarda de más o falla, y que lo diga en vez de quedarse muda.

Timeout duro de 8 s, un reintento, y descarte del lote si vuelve a fallar — con los turnos descartados arrastrados a la ventana del lote siguiente, para que lo que alguien dijo no se pierda por un fallo de infraestructura. El estado del agente se comunica con mensajes efímeros.

Es el ticket que sostiene R4 y la mitad de R8: en la demo, un fallo tiene que leerse como un aviso, nunca como un cuelgue.

**Blocked by:** 07.

**Status:** implementado — verificación apuntando a URL muerta en el entorno desplegado pendiente

- [x] Timeout duro de 8 s sobre la llamada al LLM — `lib/extract/nvidia.ts` (`fetchTimeoutMs` 7000, abort)
- [x] Un reintento; si vuelve a fallar, el lote se descarta — `pipeline.ts` `retries: 1` + arrastre
- [x] Los turnos del lote descartado entran en la ventana de contexto del lote siguiente — `pipeline.ts` (el buffer queda intacto; test)
- [x] Un mensaje efímero avisa mientras el agente está pensando — `agent.thinking` desde el runtime + banner en `ChatPanel`
- [x] Un mensaje efímero avisa cuando el agente se saltó un turno — `agent.skipped` + banner
- [ ] Apuntando el extractor a una URL muerta, la sala sigue funcionando, el chat sigue vivo y el aviso aparece — *verificación manual en el entorno desplegado*
- [x] Un lote lento no bloquea el procesamiento de los lotes siguientes — el flush no bloquea `onMessage`; los turnos a mitad de extracción siguen en el buffer
- [x] Al medir el criterio (a) se reporta por separado el p95 de los mensajes que completaron y el porcentaje que salió por la rama de descarte — `pipeline.report()` + `GET /api/extractor/report`
