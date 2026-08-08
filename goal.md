# Goal — Lienzo colaborativo con grafo de conocimiento en vivo

Entregar un prototipo funcional de lienzo colaborativo con grafo de conocimiento en vivo, construido sobre Portal (useportal.co) para la sincronización en tiempo real y sobre LLMs de capa gratuita y baja latencia (llama-3.1-8b vía NVIDIA BUILD por ejm.), demostrable en una sesión de 5 minutos con ≥3 participantes simultáneos en una misma sala temática, donde:

**(a)** cada mensaje enviado produce el broadcast de su graph-delta correspondiente —posiblemente vacío— aplicado en todos los clientes en ≤5 s p95; se reporta aparte el porcentaje de mensajes que produjeron delta no vacío;

**(b)** el grafo generado a partir de un guion de conversación de ~40 turnos alcanza ≥60% de precisión y ≥50% de recall en entidades, y ≥50% de precisión en relaciones, medido contra un grafo de referencia anotado a mano antes del hackathon;

**(c)** al cerrar la sesión el sistema genera sin intervención manual un documento markdown con ideas principales, relaciones y conclusiones.

## Verificación

Correr el guion completo 3 veces seguidas en el entorno desplegado sin caídas ni desincronización entre clientes, registrar la latencia p95 mensaje→delta-visible, y calcular precisión/recall con un script de evaluación versionado en el repo contra la anotación de referencia.

Regla de matching: una entidad acierta si su nombre normalizado (minúsculas, sin tildes, sin artículos, singular) coincide con el de una entidad gold o con uno de sus alias —escritos a mano durante la anotación— **y** el tipo coincide. Una relación acierta si sus dos extremos aciertan **y** el tipo de relación coincide. Cada gold se consume una sola vez. Se reportan las dos métricas: con tipo (la que actúa como umbral) y ignorando tipo (diagnóstico: separa fallo de comprensión de fallo de etiquetado).

El script recibe la lista de tipos permitidos como parámetro y filtra con ella tanto el gold como la extracción, de modo que quitar un tipo sea un cambio de una línea sin invalidar la métrica.

## Arquitectura decidida

Una **channel extension de Portal es dueña del grafo**: recibe las propuestas de extracción, mergea, deduplica, versiona, emite `graph.delta` y sirve `onSnapshot` a quien entra a mitad de sesión. El backend propio de Next.js hace la llamada al LLM con debounce de 3 s, ventana de contexto de los últimos ~8 turnos y la lista completa de nodos existentes en el prompt, y publica la propuesta por REST hacia el namespace de la extensión.

La propuesta llega al namespace de la extensión mediante un **cliente headless `@portalsdk/core` conectado por WS** desde el proceso de Next.js, que actúa como participante de servicio y hace `send()` como cualquier cliente. Es el mismo camino que el SDK usa para entregar tipos de extensión.

Superficie confirmada leyendo el bundle publicado del SDK:

- `https://api.useportal.co` · `wss://realtime.useportal.co`
- Auth: `authorization: Bearer <token>` + `x-portal-key: <pk_...>`; token anónimo acuñable con solo la publishable key vía `POST /v1/tokens/anonymous`
- Mensajes persistentes por HTTP POST; **efímeros y tipos de extensión por frames de WebSocket**, según la routing table `bindings` del frame `ready`

Optimización opcional, fuera del camino crítico: si `POST /v1/channels/{id}/messages` con un `type` del namespace de la extensión llegara a `onBatch`, el backend se ahorraría la conexión WS viva. La evidencia apunta a que no. Ver X1-Q1 en `spike.md`.

El LLM **no** vive dentro de la extensión: el `ExtensionContext` documentado expone solo `ctx.storage`, sin `fetch` ni `env()`.

Deploy en Railway (crédito de prueba, sin cold starts). Sin base de datos: el grafo vive en `ctx.storage`.

## Esquema (cerrado, en inglés)

Entidades: `Claim` · `Concept` · `Question` · `Evidence` · `Person` · `Decision`
Relaciones: `SUPPORTS` · `CONTRADICTS` · `ELABORATES` · `ANSWERS` · `PROPOSED_BY` · `RESOLVES`

Structured output con `enum`. Todo lo que no encaje se descarta. Prompt y esquema en inglés, con guard de idioma para entradas que no lo sean.

## Uso de Portal

Extension como dueña del grafo · cursores en vivo (efímeros + `setMetadata` throttled) · presencia · mensaje efímero "el agente está pensando" · inbox por usuario cuando una arista `CONTRADICTS` toca un `Claim` propio.

## Documento final (c)

Plantilla determinista recorriendo el grafo: decisiones con su cadena de soporte, contradicciones sin resolver, y preguntas sin arista `ANSWERS` (lo que quedó abierto). Más una llamada a un modelo grande para el párrafo de síntesis inicial, disparada al cerrar pero **no bloqueante**: el markdown se muestra completo de inmediato y el párrafo se inserta arriba cuando llega. Si nunca llega, el documento sale sin él.

## Política de fallo del LLM en vivo

Timeout duro de 8 s, un reintento, y descarte del lote si vuelve a fallar — con el turno descartado arrastrado a la ventana de contexto del lote siguiente, para que el contenido no se pierda. El fallo se comunica con un mensaje efímero, nunca con silencio.

## Alcance

**Dentro:** una sala temática, entrada por texto, pipeline de extracción entidad/relación, render del grafo en modo exploración (arrastre local, posiciones ancladas al crear, sin re-layout global), export de documentación.

**Fuera mientras (a)–(c) no estén verdes:** voz en vivo (transcripción y diarización, primer stretch — vía ASR de NVIDIA BUILD, sin nada corriendo en local), edición manual colaborativa del grafo (renombrar/fusionar/borrar, segundo stretch), múltiples salas concurrentes.

## Material de evaluación

Debate propio de ~8 min en inglés, grabado antes de escribir código, sobre una decisión técnica real de este proyecto. Transcrito, anotado por Opus y revisado a mano entre los tres. Congelado al terminar la anotación: no se toca aunque duela ver los fallos.

## Reparto y congelaciones

Uno al canvas y el render; uno al backend (webhook, debounce, LLM, publish); uno al guion, anotación y script de evaluación — este último acompañado por quien termine primero, porque sin script no existe el criterio (b).

Congelaciones: el shape de `graph.delta` acordado a los 30 min (es lo que desbloquea el paralelismo) · los tipos, antes de anotar · el gold, al terminar de anotarse · feature freeze 3 h antes del deadline para grabar el video.

## Parar y preguntar si

Los modelos de capa gratuita no superan el umbral de calidad tras 2 iteraciones de prompt/esquema — la decisión entre recortar el esquema del grafo o cambiar de modelo/proveedor es tuya, no mía.

Si el español hunde la precisión en la primera corrida, la decisión de cambiar la demo se toma antes de la hora 3, no la noche del deadline.
