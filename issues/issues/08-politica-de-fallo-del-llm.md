# 08 — Política de fallo del LLM

**What to build:** Que la sala siga viva cuando el modelo gratuito tarda de más o falla, y que lo diga en vez de quedarse muda.

Timeout duro de 8 s, un reintento, y descarte del lote si vuelve a fallar — con los turnos descartados arrastrados a la ventana del lote siguiente, para que lo que alguien dijo no se pierda por un fallo de infraestructura. El estado del agente se comunica con mensajes efímeros.

Es el ticket que sostiene R4 y la mitad de R8: en la demo, un fallo tiene que leerse como un aviso, nunca como un cuelgue.

**Blocked by:** 07.

**Status:** ready-for-agent

- [ ] Timeout duro de 8 s sobre la llamada al LLM
- [ ] Un reintento; si vuelve a fallar, el lote se descarta
- [ ] Los turnos del lote descartado entran en la ventana de contexto del lote siguiente
- [ ] Un mensaje efímero avisa mientras el agente está pensando
- [ ] Un mensaje efímero avisa cuando el agente se saltó un turno
- [ ] Apuntando el extractor a una URL muerta, la sala sigue funcionando, el chat sigue vivo y el aviso aparece
- [ ] Un lote lento no bloquea el procesamiento de los lotes siguientes
- [ ] Al medir el criterio (a) se reporta por separado el p95 de los mensajes que completaron y el porcentaje que salió por la rama de descarte
