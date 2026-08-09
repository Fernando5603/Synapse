# 04 — Extensión `graph-owner` desplegada: el canvas pinta un delta

**What to build:** La primera vez que un nodo aparece en tres pantallas a la vez. La channel extension está desplegada y su `onBatch` sobre el namespace `graph.` devuelve un delta **hardcodeado**; el cliente se suscribe y lo pinta. El disparo es un `send()` desde la consola del navegador — el backend todavía no participa.

Este es el ticket bisagra del hackathon: **al aterrizar, el contrato de datos queda congelado** y los tres frentes pueden trabajar en paralelo contra él. También responde X1-Q4 de paso, sin dedicarle un spike.

No hay merge real aquí. La extensión miente a propósito: devuelve siempre el mismo delta.

**Blocked by:** 01 (contrato de datos), 02 (sala desplegada).

**Status:** ready-for-agent

- [x] La extensión está desplegada y su `onBatch` recibe mensajes del namespace `graph.`
- [x] `onBatch` emite el delta como **valor de retorno**, no como un publish separado — verificado desde fuera del navegador con `portal listen`: el remitente del `graph.delta` es `ext:graph`, no un cliente
- [x] El cliente se suscribe a `graph.delta` y pinta los nodos y aristas que llegan
- [x] Disparado con un `send()` desde la consola de una pestaña, el mismo nodo aparece en las tres
- [x] El badge de versión del grafo refleja la versión del último delta recibido
- [x] Queda anotado en `spike.md` cuánto dura el ciclo editar→desplegar→probar de una extensión (X1-Q4)
- [x] Queda comunicado al equipo que el contrato de datos está congelado: cambiarlo a partir de aquí requiere acuerdo de los tres — escrito en `AGENTS.md` y en `extensions/README.md`
