# 13 — Script de evaluación

**What to build:** El instrumento que decide si el criterio (b) de `goal.md` está verde. Corre el guion anotado por el pipeline, vuelca el grafo resultante y lo compara con el gold, reportando precisión y recall.

No es un test: no falla el build, produce un número. Es la única forma de saber si la extracción sirve.

Reporta **dos** métricas por diseño: con tipo (la que actúa como umbral) e ignorando tipo (diagnóstico, separa un fallo de comprensión de uno de etiquetado). Y recibe la lista de tipos permitidos como parámetro, de modo que recortar el esquema sea un cambio de una línea y no invalide la métrica — que es exactamente la palanca que el equipo va a querer si los modelos gratuitos no llegan al umbral.

**Blocked by:** 03 (gold anotado), 06 (grafo autoritativo), 07 (pipeline de extracción).

**Status:** ready-for-agent

- [ ] El script recibe la lista de tipos permitidos como parámetro y filtra con ella tanto el gold como la extracción
- [ ] Corre el guion completo por el pipeline y vuelca el grafo resultante
- [ ] El matching normaliza nombres (minúsculas, sin tildes, sin artículos, singular) y acepta los alias anotados a mano
- [ ] Una entidad acierta si el nombre normalizado coincide **y** el tipo coincide
- [ ] Una relación acierta si sus dos extremos aciertan **y** el tipo de relación coincide
- [ ] Cada entidad gold se consume una sola vez
- [ ] Reporta precisión y recall de entidades, y precisión de relaciones, con tipo y sin tipo
- [ ] Quitar un tipo del esquema es un cambio de una línea que no invalida la métrica
- [ ] Está versionado en el repo
