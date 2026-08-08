# 09 — Render de exploración

**What to build:** Que el lienzo sea legible y estable con el tamaño de una sesión real. Los nodos se quedan donde aparecieron, la llegada de un delta no reorganiza nada, y cada uno puede ordenar su propia vista sin pisarle la de los demás.

**Decisión que este ticket cierra:** la posición inicial de un nodo se siembra de forma **determinista desde su `id`**, no desde el orden de llegada. Con siembra por orden de llegada los tres participantes ven tres disposiciones distintas del mismo grafo, y en la demo se nota — deja de poder decirse "el nodo de arriba a la izquierda". La versión determinista cuesta lo mismo.

**Blocked by:** 04.

**Status:** done (canvas con mock mientras 04/06 no existen)

- [x] La posición inicial de un nodo se siembra de forma determinista desde su `id`: las tres pantallas coinciden — `lib/layout.ts` `seedPosition`
- [x] Un nodo se queda donde apareció; la llegada de un delta no reorganiza el lienzo — `relaxInto` mueve solo los nuevos
- [x] El force-directed corre solo contra vecinos inmediatos, nunca global — `relaxLocal`/`relaxInto`
- [x] Aristas `SUPPORTS` en verde y `CONTRADICTS` en rojo — `GraphCanvas`
- [x] Arrastrar un nodo lo mueve solo en mi pantalla — estado local del canvas
- [x] El tipo de cada nodo se distingue de un vistazo — color + letra por tipo, leyenda
- [x] Con ~40 nodos el lienzo sigue siendo legible — mock de 40 nodos en `lib/mockGraph.ts`

Fuente real pendiente: `GraphCanvas` ya recibe un `Graph` por props; al aterrizar 04/06 el mock en `Room` se sustituye por el grafo autoritativo sin tocar el canvas.
