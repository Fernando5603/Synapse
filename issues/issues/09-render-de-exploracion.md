# 09 — Render de exploración

**What to build:** Que el lienzo sea legible y estable con el tamaño de una sesión real. Los nodos se quedan donde aparecieron, la llegada de un delta no reorganiza nada, y cada uno puede ordenar su propia vista sin pisarle la de los demás.

**Decisión que este ticket cierra:** la posición inicial de un nodo se siembra de forma **determinista desde su `id`**, no desde el orden de llegada. Con siembra por orden de llegada los tres participantes ven tres disposiciones distintas del mismo grafo, y en la demo se nota — deja de poder decirse "el nodo de arriba a la izquierda". La versión determinista cuesta lo mismo.

**Blocked by:** 04.

**Status:** done — la fuente real aterrizó con el ticket 04: la sala se alimenta del `graph.delta` de la extensión (`Room` aplica `applyDelta`), y `GraphCanvas` la recibe por props. El mock quedó como fixture del test de layout (escala de sesión), no cuelga de la sala.

- [x] La posición inicial de un nodo se siembra de forma determinista desde su `id`: las tres pantallas coinciden — `lib/layout.ts` `seedPosition`
- [x] Un nodo se queda donde apareció; la llegada de un delta no reorganiza el lienzo — el canvas solo siembra los nodos nuevos
- [x] El force-directed corre solo contra vecinos inmediatos, nunca global — `relaxNeighbors` al soltar el arrastre
- [x] Aristas `SUPPORTS` en verde y `CONTRADICTS` en rojo — `GraphCanvas`
- [x] Arrastrar un nodo lo mueve solo en mi pantalla — estado local del canvas
- [x] El tipo de cada nodo se distingue de un vistazo — color + letra por tipo, leyenda
- [x] Con ~40 nodos el lienzo sigue siendo legible — fixture `lib/mockGraph.ts` en el test de layout
