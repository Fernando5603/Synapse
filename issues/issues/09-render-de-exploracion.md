# 09 — Render de exploración

**What to build:** Que el lienzo sea legible y estable con el tamaño de una sesión real. Los nodos se quedan donde aparecieron, la llegada de un delta no reorganiza nada, y cada uno puede ordenar su propia vista sin pisarle la de los demás.

**Decisión que este ticket cierra:** la posición inicial de un nodo se siembra de forma **determinista desde su `id`**, no desde el orden de llegada. Con siembra por orden de llegada los tres participantes ven tres disposiciones distintas del mismo grafo, y en la demo se nota — deja de poder decirse "el nodo de arriba a la izquierda". La versión determinista cuesta lo mismo.

**Blocked by:** 04.

**Status:** ready-for-agent

- [ ] La posición inicial de un nodo se siembra de forma determinista desde su `id`: las tres pantallas coinciden
- [ ] Un nodo se queda donde apareció; la llegada de un delta no reorganiza el lienzo
- [ ] El force-directed corre solo contra vecinos inmediatos, nunca global
- [ ] Aristas `SUPPORTS` en verde y `CONTRADICTS` en rojo
- [ ] Arrastrar un nodo lo mueve solo en mi pantalla
- [ ] El tipo de cada nodo se distingue de un vistazo
- [ ] Con ~40 nodos el lienzo sigue siendo legible
