# 10 — Cursores en vivo

**What to build:** Ver el puntero de los demás moverse en tiempo real sobre el lienzo, para poder señalar un nodo y decir "eso" sin describirlo.

Dos mecanismos, no uno: el movimiento va como mensaje efímero throttled, y `setMetadata` throttled a 250 ms mantiene la última posición conocida. El segundo es lo que hace que quien entra tarde vea dónde está la gente sin esperar a que alguien mueva el ratón.

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] El cursor se envía como mensaje efímero en `pointermove`, throttled
- [ ] `setMetadata` throttled a 250 ms mantiene la última posición conocida de cada participante
- [ ] Veo el cursor de los otros dos moverse en tiempo real
- [ ] Una pestaña abierta a mitad de sesión ve dónde están los cursores sin esperar a que se muevan
- [ ] Cada cursor es atribuible a su participante
- [ ] El throttle es suficiente para que el tráfico de cursores no retrase la llegada de los deltas
