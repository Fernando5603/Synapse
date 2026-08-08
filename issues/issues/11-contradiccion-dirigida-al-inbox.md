# 11 — Contradicción dirigida al inbox

**What to build:** Cuando alguien afirma algo que contradice un `Claim` tuyo, te llega un aviso a ti — no un mensaje más en el canal que se pierde entre los demás.

La detección entra en `graph-core` como función pura, y el backend la llama antes de entregar la propuesta, sobre su espejo del grafo. Es aproximada por construcción: mira el estado anterior al merge. Para el caso de demo basta, y evita tener que meter lógica de negocio en la extensión.

El aviso se emite como mensaje dirigido y una regla de configuración lo convierte en item de inbox. No hay endpoint suelto de notificaciones.

**Blocked by:** 06 (grafo autoritativo), 07 (espejo del grafo en el backend).

**Status:** ready-for-agent

- [ ] `detectContradiction` entra en `graph-core` como función pura, con tests
- [ ] Devuelve el autor del `Claim` cuando la propuesta trae un `CONTRADICTS` hacia un `Claim` con `PROPOSED_BY` a ese autor
- [ ] Devuelve nulo cuando el autor de la propuesta es el mismo que el del `Claim`: nadie se notifica a sí mismo
- [ ] El backend la llama antes de entregar la propuesta, sobre su espejo del grafo
- [ ] El aviso se emite como mensaje dirigido y una regla de configuración lo convierte en item de inbox
- [ ] El aviso llega solo al autor del `Claim` contradicho, no al canal
- [ ] Desde el aviso se llega al nodo correspondiente en el lienzo
