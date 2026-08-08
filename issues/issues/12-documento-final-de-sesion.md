# 12 — Documento final de sesión

**What to build:** Cierras la sesión y sale un markdown, sin intervención manual: las decisiones con su cadena de soporte, las contradicciones sin resolver y las `Question` sin arista `ANSWERS` como lo que quedó abierto. Es el criterio (c) de `goal.md`.

La plantilla es determinista y recorre el grafo — entra en `graph-core` como función pura. La síntesis por modelo grande se dispara al cerrar pero **no bloquea**: el markdown se muestra completo de inmediato y el párrafo se inserta arriba cuando llega. Si nunca llega, el documento sale sin él.

**Decisión que este ticket cierra:** el documento se genera desde un **snapshot fresco del grafo autoritativo**, no desde el espejo que el backend mantiene para el prompt. Si el espejo perdió un delta, el documento miente y no hay forma de detectarlo desde dentro.

**Blocked by:** 06.

**Status:** ready-for-agent

- [ ] `renderDocument` entra en `graph-core` como función pura, con tests
- [ ] Lista las decisiones con su cadena de soporte
- [ ] Lista las contradicciones sin resolver
- [ ] Lista las `Question` sin arista `ANSWERS` como lo que quedó abierto
- [ ] Sobre un grafo vacío produce un documento válido, no una excepción
- [ ] Cerrar la sesión muestra el markdown completo de inmediato, sin esperar a ningún modelo
- [ ] La síntesis se dispara al cerrar, no bloquea, y el párrafo se inserta arriba al llegar
- [ ] Si el párrafo nunca llega, el documento sigue siendo válido
- [ ] El documento se genera desde un snapshot fresco del grafo autoritativo, no desde el espejo del backend
- [ ] El markdown se puede descargar
