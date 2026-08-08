---
spec: true
---

# Spec — Lienzo colaborativo con grafo de conocimiento en vivo

Status: ready-for-agent

Documentos de origen: `goal.md` (criterio de éxito) · `shaping.md` (shape C) · `breadboard.md` (afordances y slicing V1–V9) · `spike.md` (X1).

---

## Problem Statement

Tres personas discuten una decisión técnica durante 40 minutos. Al terminar, lo que existe es un hilo de chat: lineal, sin estructura, donde una afirmación y la evidencia que la sostiene están separadas por veinte mensajes, y donde nadie sabe qué preguntas quedaron sin responder salvo releyéndolo entero.

El problema no es que falte un resumen al final. Es que **durante** la conversación nadie ve la forma de lo que están construyendo: quién contradijo a quién, qué decisión se apoya en qué, qué se preguntó y se quedó colgando. Esa estructura solo aparece si alguien la construye a mano —y entonces esa persona deja de participar en la conversación—, o no aparece nunca.

Hoy no existe ningún sistema previo. Es greenfield.

## Solution

Una sala compartida donde la conversación se escribe en un chat normal y, mientras ocurre, un grafo de conocimiento tipado se construye solo al lado y se aplica en la pantalla de todos los participantes en menos de cinco segundos.

Nadie crea nodos. Se habla, y aparecen. Cada afirmación es un `Claim`, cada pregunta una `Question`, y las relaciones entre ellas —`SUPPORTS`, `CONTRADICTS`, `ANSWERS`— se dibujan como aristas de colores. Cuando alguien contradice una afirmación tuya, te llega un aviso dirigido, no un mensaje más en el canal. Quien entra a mitad de sesión ve el grafo completo al instante. Al cerrar, el sistema produce sin intervención manual un markdown con las decisiones y su cadena de soporte, las contradicciones sin resolver y las preguntas que quedaron abiertas.

El grafo es propiedad de una **channel extension de Portal**, que hace de fuente de verdad: recibe propuestas de extracción, mergea, deduplica, versiona, emite el delta a todos y sirve el grafo entero a quien llega tarde. El backend de Next.js solo extrae: escucha los mensajes, espera 3 s, le pide a un LLM barato que proponga entidades y relaciones sobre una ventana de contexto, y entrega esa propuesta a la extensión como un participante más del canal.

## User Stories

**Sala y conversación**

1. Como participante, quiero entrar a la sala desde un enlace y sin crear cuenta, para poder empezar a hablar en segundos.
2. Como participante, quiero escribir un mensaje y verlo en el hilo, para saber que llegó.
3. Como participante, quiero ver los mensajes de los demás en el mismo hilo, para seguir la conversación.
4. Como participante, quiero ver quién está en la sala ahora mismo, para saber con quién estoy hablando.
5. Como participante que entra a mitad de sesión, quiero ver el historial del chat, para entender de qué se viene hablando.
6. Como participante, quiero que mi nombre me identifique en el roster y en mis mensajes, para que los demás sepan quién dijo qué.

**El grafo en vivo**

7. Como participante, quiero que lo que decimos se convierta en nodos sin que nadie los cree a mano, para que hablar sea suficiente.
8. Como participante, quiero ver el nodo nuevo aparecer en ≤5 s desde el mensaje que lo produjo, para que el grafo se sienta parte de la conversación y no un informe posterior.
9. Como participante, quiero que ese nodo aparezca en la pantalla de los demás a la vez que en la mía, para que estemos mirando lo mismo.
10. Como participante, quiero que un mensaje que no aporta estructura no ensucie el grafo, para que el lienzo siga legible.
11. Como participante, quiero ver el tipo de cada nodo, para distinguir de un vistazo una afirmación de una pregunta o de una decisión.
12. Como participante, quiero que si dos personas dicen lo mismo con otras palabras salga un solo nodo, para no acabar con el grafo duplicado.
13. Como participante, quiero ver una arista `SUPPORTS` en verde y una `CONTRADICTS` en roja, para leer la estructura del desacuerdo sin leer texto.
14. Como participante, quiero ver la versión del grafo, para saber si mi pantalla está al día.
15. Como participante que entra a mitad de sesión, quiero ver el grafo completo al instante, sin esperar a que se regenere desde el historial.
16. Como participante, quiero que el grafo sobreviva al reciclaje del proceso que lo aloja, para no perder veinte minutos de conversación por una operación de infraestructura.
17. Como participante, quiero que el agente no se alimente de sus propias salidas, para que el grafo no crezca solo cuando nadie está hablando.
18. Como participante, quiero que un mensaje que no produjo nodos igualmente se registre como procesado, para poder distinguir "no aportaba nada" de "el sistema se lo tragó".

**Cuando el LLM falla**

19. Como participante, quiero que la sala siga funcionando cuando el modelo tarda o falla, para poder seguir hablando.
20. Como participante, quiero saber cuándo el agente está pensando, para no repetirme creyendo que no me oyó.
21. Como participante, quiero que me avisen cuando el agente se saltó un turno, para no asumir que lo que dije no valía nada.
22. Como participante, quiero que lo que dije en un turno descartado entre en el análisis siguiente, para no tener que repetirlo.
23. Como participante, quiero que un modelo lento no bloquee el procesamiento de lo que digamos después, para que un fallo no se convierta en un atasco en cascada.

**Render y manipulación**

24. Como participante, quiero que un nodo se quede donde apareció, para no perder el mapa mental cada vez que llega un delta.
25. Como participante, quiero que la llegada de un nodo nuevo no reorganice el lienzo entero, para poder seguir mirando lo que estaba mirando.
26. Como participante, quiero mover un nodo a donde me convenga, para ordenar mi propia vista.
27. Como participante, quiero que mover un nodo no se lo mueva a nadie más, para no pisarle la vista a otro.
28. Como participante, quiero que el lienzo siga siendo legible con unos 40 nodos, porque ese es el tamaño de una sesión real.
29. Como participante, quiero ver el mismo grafo que los demás también en su disposición espacial, para poder decir "el nodo de arriba a la izquierda" y que signifique algo.

**Presencia y cursores**

30. Como participante, quiero ver el cursor de los demás moverse en tiempo real, para saber qué están mirando mientras hablan.
31. Como participante, quiero señalar un nodo con el cursor y que los otros lo vean, para poder decir "eso" sin describirlo.
32. Como participante que entra tarde, quiero ver dónde están los cursores de los demás sin tener que esperar a que se muevan.
33. Como participante, quiero que mi cursor no sature la conexión, para que el grafo no llegue tarde por culpa de mi ratón.

**Contradicciones**

34. Como autor de un `Claim`, quiero que me avisen cuando alguien afirma algo que lo contradice, para poder responder en el momento y no al releer el documento.
35. Como autor de un `Claim`, quiero que ese aviso me llegue a mí y no al canal entero, para que no sea un mensaje más que se pierde.
36. Como participante, quiero que el aviso me lleve al nodo en cuestión, para no tener que buscarlo en el lienzo.
37. Como participante, quiero no recibir aviso cuando la contradicción toca un `Claim` que no es mío, para que la notificación siga significando algo.

**Documento final**

38. Como facilitador, quiero cerrar la sesión con un botón y obtener el documento, sin ningún paso manual intermedio.
39. Como facilitador, quiero ver el documento completo de inmediato, sin esperar a ninguna llamada a un modelo.
40. Como facilitador, quiero un párrafo de síntesis que se inserte arriba cuando esté listo, y que el documento siga siendo válido si ese párrafo nunca llega.
41. Como facilitador, quiero que el documento liste las decisiones con su cadena de soporte, para saber en qué se apoyó cada una.
42. Como facilitador, quiero que liste las contradicciones sin resolver, para saber qué quedó en disputa.
43. Como facilitador, quiero que liste las `Question` sin arista `ANSWERS`, para saber qué quedó abierto.
44. Como facilitador, quiero descargar el markdown, para pegarlo donde haga falta.
45. Como facilitador, quiero que el documento se genere desde el grafo autoritativo y no desde una copia que pudo desincronizarse, para que no mienta en silencio.

**Evaluación de calidad**

46. Como evaluador, quiero correr el guion de ~40 turnos y obtener precisión y recall de entidades y relaciones, para saber si el criterio (b) está verde.
47. Como evaluador, quiero la métrica con tipo y sin tipo, para separar un fallo de comprensión de un fallo de etiquetado.
48. Como evaluador, quiero pasar la lista de tipos permitidos como parámetro, para que quitar un tipo del esquema sea un cambio de una línea y no invalide la métrica.
49. Como evaluador, quiero que cada entidad gold se consuma una sola vez, para que duplicar una extracción no infle la precisión.
50. Como evaluador, quiero que los alias anotados a mano cuenten como acierto, para no castigar una forma legítima del mismo concepto.
51. Como evaluador, quiero que el gold quede congelado al terminar de anotarlo, para que la métrica no se mueva bajo los pies mientras iteramos el prompt.

**Demo y operación**

52. Como presentador, quiero que la demo corra en un entorno desplegado y no en una laptop, para no depender de la red de la sala.
53. Como presentador, quiero que no haya cold start, para que el primer mensaje de la demo no tarde veinte segundos.
54. Como presentador, quiero que ningún fallo deje la interfaz muda, para que un error se lea como un aviso y no como un cuelgue.
55. Como jurado, quiero ver primitivos de Portal cargando peso real —una extensión dueña del estado, presencia, efímeros, inbox dirigido—, no un websocket disfrazado de plataforma.

**Equipo**

56. Como desarrollador de canvas, quiero el shape de `graph.delta` congelado en cuanto V2 pinte un nodo falso, para trabajar contra un contrato y no esperar al backend.
57. Como desarrollador de backend, quiero un contrato de propuesta estable, para cambiar el prompt sin romper a nadie.
58. Como evaluador, quiero la lista de tipos congelada antes de empezar a anotar, para no tener que rehacer el gold.

---

## Implementation Decisions

### Arquitectura

Shape **C** de `shaping.md`, con C3.4 resuelto por **C3.4-B**. Tres procesos:

- **Cliente Next.js** — sala, chat, canvas, presencia, cursores, documento final.
- **Backend Next.js** — route handler del webhook, buffer de turnos, llamada al LLM, detección de contradicción, generación del documento, y un cliente headless de `@portalsdk/core` conectado por WebSocket.
- **Channel extension de Portal (`graph-owner`)** — dueña del grafo autoritativo.

Sin base de datos. El grafo vive en memoria de la instancia de la extensión y se persiste en `ctx.storage`. Deploy en Railway (crédito de prueba, sin cold starts, sin túnel).

### El seam: `graph-core`

Todo el comportamiento determinista del sistema vive en un módulo puro, **sin un solo import de Portal, `fetch`, `Date` ni nada de Next.js**. Tres funciones:

```
mergeProposal(graph, proposal)      -> { graph, delta }
detectContradiction(graph, proposal) -> { targetUserId, claimId } | null
renderDocument(graph)                -> string
```

Consecuencias de diseño que esto impone:

- El `onBatch` de la extensión queda en tres líneas: leer estado, llamar `mergeProposal`, devolver el delta. No hay lógica que testear ahí.
- La detección de contradicción no vive en el backend "porque tiene la lista de nodos a mano": vive en `graph-core` y el backend la llama pasándole su espejo del grafo.
- El render del documento no consulta nada. Recibe un grafo y devuelve un string.
- `graph-core` es compartido por el backend y la extensión. Los dos importan el mismo módulo.

### Contrato de datos (congelado al terminar V2)

Es el contrato que desbloquea el paralelismo. Ninguna de las tres personas puede cambiarlo unilateralmente después de V2.

```
Node     = { id, type: EntityType, name, proposedBy?: userId }
Edge     = { id, type: RelationType, from: nodeId, to: nodeId }
Graph    = { nodes: Node[], edges: Edge[], version: number }
Proposal = { nodes: Omit<Node,"id">[], edges: {type, from: name, to: name}[] }
Delta    = { addedNodes: Node[], addedEdges: Edge[], version: number }
```

- `EntityType`: `Claim` · `Concept` · `Question` · `Evidence` · `Person` · `Decision`
- `RelationType`: `SUPPORTS` · `CONTRADICTS` · `ELABORATES` · `ANSWERS` · `PROPOSED_BY` · `RESOLVES`
- Una `Proposal` refiere a los nodos **por nombre**, no por id: el LLM no conoce ids. Resolver nombre→id es trabajo de `mergeProposal`.
- Un `Delta` vacío es un delta válido y se emite igual, con la versión incrementada. El criterio (a) exige poder distinguir "no había nada que extraer" de "el mensaje se perdió".

### Extracción (backend)

- Webhook `message.published` de Portal → route handler. **Primera línea: filtro por namespace y `channelId`.** No es higiene, es lo que impide que el backend se auto-alimente: desde C3.4-B el propio backend es un participante del canal, así que sus `graph.proposal` y los `graph.delta` de la extensión vuelven por el mismo webhook.
- Debounce de 3 s sobre el buffer de turnos. Ventana de contexto: los últimos 8 turnos.
- El prompt lleva la **lista completa de nodos existentes**. Esa lista **no** la construye el backend acumulando sus propias propuestas: la recibe de los `graph.delta` autoritativos por el cliente headless, más el `onSnapshot` de la conexión. Sin esto el prompt deriva de la verdad y el dedupe acaba haciendo todo el trabajo.
- Structured output con `enum` sobre el esquema cerrado. Todo lo que no encaje se descarta. Prompt y esquema en inglés, con guard de idioma para entradas que no lo sean.
- Política de fallo: timeout duro de 8 s, un reintento, descarte del lote si vuelve a fallar. Los turnos del lote descartado se arrastran a la ventana del lote siguiente. El fallo se comunica con un mensaje efímero, nunca con silencio.

### Entrega a la extensión (C3.4-B)

El backend mantiene un cliente `@portalsdk/core` conectado por WebSocket como participante de servicio: acuña un token anónimo con la publishable key vía `POST /v1/tokens/anonymous` y hace `send()` al namespace `graph.` como cualquier cliente. Es el mismo camino que el SDK usa para entregar tipos de extensión.

No se usa `POST /v1/channels/{id}/messages` para esto: el bundle publicado del SDK enruta los tipos de extensión por frames de WS **en lugar** del POST HTTP.

### La extensión

- `onBatch` sobre el namespace `graph.` recibe las propuestas.
- Merge con dedupe por nombre normalizado (minúsculas, sin tildes, sin artículos, singular) y versión incremental.
- `ctx.storage` tras cada merge, para sobrevivir al reciclaje de instancia. `onInit` rehidrata desde ahí.
- El delta se emite como valor de retorno de `onBatch`, no como publish separado.
- `onSnapshot()` entrega el grafo completo en la trama de conexión. Esto es lo que resuelve el late-join; no hay backfill ni replay del historial.

### Render

- Posición asignada al crear el nodo y fija a partir de ahí. Force-directed solo local contra vecinos inmediatos; nunca re-layout global.
- **Decisión pendiente de confirmar antes de V6:** la posición inicial se siembra de forma determinista desde el `id` del nodo, no desde el orden de llegada. Con siembra por orden de llegada los tres participantes ven tres disposiciones distintas del mismo grafo, lo que rompe la historia 29 y se nota en la demo. La versión determinista cuesta lo mismo.
- El arrastre de nodos es estado puramente local. No se sincroniza.
- Aristas `SUPPORTS` verdes, `CONTRADICTS` rojas.

### Cursores y presencia

- Cursores por `send({ ephemeral: true })` en `pointermove`, throttled.
- `setMetadata()` throttled a 250 ms como fallback: es lo que permite que quien entra tarde vea los cursores sin esperar a que alguien mueva el ratón.
- Presencia por el roster nativo del canal.

### Contradicción dirigida

- La detección corre en `graph-core`, invocada por el backend antes de entregar la propuesta, sobre el espejo del grafo. Es aproximada por construcción: mira el estado anterior al merge. Para el caso de demo basta.
- Dispara si la propuesta contiene un `CONTRADICTS` hacia un `Claim` que tiene una arista `PROPOSED_BY` hacia el usuario X, y X no es el autor del mensaje que originó la propuesta.
- Se emite como mensaje dirigido con `to: X` por la ruta REST. Una regla en `portal.config.ts` devuelve un descriptor de notificación que Portal convierte en item de inbox.

### Documento final

- Plantilla determinista recorriendo el grafo: decisiones con su cadena de soporte, contradicciones sin resolver, `Question` sin arista `ANSWERS`.
- El markdown se muestra completo de inmediato. La síntesis por modelo grande se dispara al cerrar y **no bloquea**: el párrafo se inserta arriba al llegar, y si no llega el documento sale sin él.
- **Decisión pendiente de confirmar en V9:** el handler de cierre pide un `onSnapshot` fresco antes de renderizar, en vez de usar el espejo que el backend mantiene para el prompt. Si el espejo perdió un delta, el documento miente y no hay forma de detectarlo desde dentro.

### Evaluación

- Script CLI versionado en el repo, parametrizado por la lista de tipos permitidos, que filtra con ella tanto el gold como la extracción.
- Matching normalizado por conjuntos. Una entidad acierta si su nombre normalizado coincide con el de una entidad gold o con uno de sus alias anotados a mano **y** el tipo coincide. Una relación acierta si sus dos extremos aciertan **y** el tipo coincide. Cada gold se consume una sola vez.
- Reporta las dos métricas: con tipo (la que actúa como umbral) e ignorando tipo (diagnóstico).
- El material es un debate propio de ~8 min en inglés, grabado antes de escribir código, anotado por Opus y revisado a mano. Congelado al terminar la anotación.

### Orden de construcción

Los nueve slices de `breadboard.md` (V1–V9) son el orden de implementación. V1 y V2 son secuenciales y de los tres; a partir de V3 el trabajo se abre en tres frentes. El evento que desbloquea el paralelismo no es el reloj sino V2: en cuanto la extensión pinta un nodo falso en las tres pantallas, el contrato de datos queda congelado.

---

## Testing Decisions

### Qué es un buen test aquí

Un test comprueba **comportamiento externo**: le da a `graph-core` un grafo y una propuesta, y afirma cómo queda el grafo, qué dice el delta o qué contiene el markdown. Ningún test nombra una función interna, ni comprueba cómo se normaliza un nombre, ni cuántas veces se llamó a nada. Si mañana el dedupe se reescribe con otro algoritmo y el comportamiento observable no cambia, ningún test debe romperse.

Los nombres de test describen la regla de negocio, no el método: *"dos propuestas del mismo Concept con distinta grafía dan un solo nodo"*, no *"mergeProposal llama a normalizeName"*.

### Qué se testea

**Solo `graph-core`.** Un único seam. Los tests lo importan y lo llaman directamente: sin servidor, sin Portal, sin red, sin reloj.

Casos que deben existir:

- Una propuesta sobre un grafo vacío produce los nodos y el delta correspondiente.
- Dos propuestas del mismo concepto con distinta grafía (mayúsculas, tildes, plural, artículo) producen un solo nodo.
- Reaplicar una propuesta ya mergeada no añade nada y no ensucia el delta.
- Una propuesta que no aporta nada nuevo produce un **delta vacío con la versión incrementada** — es el caso que sostiene el criterio (a).
- La versión crece de forma monótona y el delta siempre la reporta.
- Una arista cuyos extremos se refieren por nombre se resuelve contra nodos ya existentes en vez de crearlos duplicados.
- Una arista hacia un nombre que no existe crea el nodo o se descarta — sea cual sea la regla, hay un test que la fija.
- `detectContradiction` devuelve el autor del `Claim` contradicho.
- `detectContradiction` devuelve `null` cuando el autor de la propuesta es el mismo que el del `Claim` (nadie se notifica a sí mismo).
- `renderDocument` lista una `Question` sin arista `ANSWERS` bajo "lo que quedó abierto", y deja de listarla cuando la arista existe.
- `renderDocument` lista una `Decision` con su cadena de soporte.
- `renderDocument` sobre un grafo vacío produce un documento válido, no una excepción.

### Qué no se testea, y por qué

- **La extracción del LLM.** No es determinista y no se asserta. Su calidad se **mide**, no se afirma: el instrumento es el script de evaluación contra el gold, y el umbral es el criterio (b). El script de evaluación no es un test — no falla el build, produce un número.
- **El transporte de Portal, el webhook, el cliente headless, la extensión desplegada.** El ciclo de despliegue de una extensión es todavía un unknown (X1-Q4) y el entorno no es determinista. Se verifican en las tres corridas del guion sobre el entorno desplegado, que es lo que `goal.md` ya define como verificación.
- **La política de fallo del LLM (timeout, reintento, arrastre).** Queda fuera del seam por decisión explícita: convertirla en reducer puro con efectos como datos habría costado acordar el patrón a la hora 0, sobre el camino crítico. Se verifica a mano en V5 apuntando el extractor a una URL muerta.
- **El render.** Se verifica mirándolo.

### Prior art

Ninguno: el repo es greenfield y no hay tests previos que imitar. Esto **fija la convención**, no la hereda. Los tests de `graph-core` son el precedente para cualquier test que venga después.

---

## Out of Scope

Fuera mientras (a)–(c) de `goal.md` no estén verdes:

- **Voz en vivo** — transcripción y diarización. Primer stretch, vía ASR de NVIDIA BUILD, sin nada corriendo en local.
- **Edición manual colaborativa del grafo** — renombrar, fusionar, borrar nodos. Segundo stretch.
- **Múltiples salas concurrentes.** Una sala temática, fija.

Fuera del proyecto entero:

- Autenticación real. El acceso es por token anónimo acuñado con la publishable key.
- Base de datos. El grafo vive en `ctx.storage`.
- Re-layout global del grafo, algoritmos de layout más allá del force local contra vecinos.
- Sincronizar la posición de los nodos arrastrados entre participantes.
- Historial o time-travel del grafo. Solo existe el estado actual y su versión.
- Resolver contradicciones desde la interfaz. Se detectan y se notifican; resolverlas es conversación humana.
- Tests de transporte, de la extensión desplegada, del prompt o del render.
- Cualquier configuración de issue tracker: por decisión del usuario, este spec vive como archivo junto a `goal.md`, `shaping.md` y `breadboard.md`, y no se ha escrito `docs/agents/issue-tracker.md`.

---

## Further Notes

**El presupuesto de R1 no cierra en el papel, y está bien.** El debounce de 3 s se come tres quintos del p95 de 5 s; el timeout de 8 s del LLM está por encima del presupuesto entero. Es la decisión correcta —C4.2 prefiere tarde y vivo a mudo—, pero significa que un mensaje lento no incumple R1: sale de la métrica por la puerta de la política de fallo. Al medir (a) hay que reportar por separado el p95 de los mensajes que completaron y el porcentaje que salió por la rama de descarte, o el número mentirá.

**Dos decisiones quedan explícitamente abiertas en el spec** y las dos están marcadas arriba: la siembra determinista de posiciones (confirmar antes de V6) y el snapshot fresco para el documento final (confirmar en V9). Ninguna bloquea empezar; las dos son baratas si se deciden a tiempo y caras si se descubren en la demo.

**Unknowns vivos**, de `spike.md`, ya fuera del camino crítico:

- **X1-Q1** — si el publish REST entra al namespace de una extensión. La evidencia apunta a que no. Si funcionara, el backend se ahorraría la conexión WS viva; no cambia nada más.
- **X1-Q4** — cuánto dura el ciclo editar→desplegar→probar de una extensión. Es lo que determina si iterar sobre `graph-owner` bajo presión es viable. V2 lo responde de paso.
- **X1-Q6** — qué se rehidrata solo desde `ctx.storage` y qué hay que reconstruir en `onInit`. Se responde al construir V4.

**Congelaciones** que gobiernan el orden: el contrato de datos al terminar V2 · la lista de tipos antes de anotar el gold · el gold al terminar la anotación · feature freeze 3 h antes del deadline para grabar el vídeo. V7 (cursores) y V8 (inbox) son los candidatos naturales a caer en el freeze: son los que más cargan R5 pero ninguno bloquea (a), (b) ni (c).

**Parar y preguntar si** los modelos de capa gratuita no superan el umbral de calidad tras dos iteraciones de prompt y esquema; la decisión entre recortar el esquema del grafo o cambiar de proveedor es del equipo. Y si el español hunde la precisión en la primera corrida, la decisión de cambiar la demo se toma antes de la hora 3, no la noche del deadline.
