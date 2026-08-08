---
shaping: true
---

# Lienzo colaborativo con grafo en vivo — Shaping

Documento de trabajo. Ground truth para R, shapes, parts y fit check.
`goal.md` conserva el criterio de éxito (a)/(b)/(c) y la verificación; cuando cambie una shape aquí, hay que rippearlo allá.

---

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Convertir una conversación multi-participante en un grafo de conocimiento tipado, sin intervención manual | Core goal |
| R1 | Todos los participantes ven el mismo grafo, con el delta de cada mensaje aplicado en ≤5 s p95 | Must-have |
| R2 | Quien entra a mitad de sesión ve el grafo completo de inmediato | Must-have |
| R3 | La calidad del grafo es medible contra una referencia anotada, y se mide | Must-have |
| R4 | El sistema sigue funcionando cuando el LLM gratuito tarda de más o falla | Must-have |
| R5 | Portal se usa de forma profunda y relevante, no como simple websocket | Must-have (criterio del jurado) |
| R6 | Al cerrar la sesión se produce documentación automática con lo decidido y lo que quedó abierto | Must-have |
| R7 | Construible por 3 personas en el plazo del hackathon, con paralelismo desde los primeros 30 min | Must-have |
| R8 | La demo en vivo no depende de una laptop, no sufre cold starts y nunca se queda muda ante un fallo | Must-have |

**CURRENT:** no existe sistema previo. Greenfield.

---

## A: Portal como transporte, todo en Next.js

| Part | Mechanism | Flag |
|------|-----------|:----:|
| **A1** | Channel de Portal: chat persistente + presencia + cursores efímeros | |
| **A2** | Webhook `message.published` → route handler de Next.js; filtro por namespace y `channelId` en la primera línea (corta el bucle de auto-alimentación) | |
| **A3** | Debounce 3 s, ventana de 8 turnos, lista completa de nodos en el prompt, structured output con `enum` | |
| **A4** | Grafo autoritativo en memoria del proceso Next.js + volcado a JSON en disco | |
| **A5** | Publish REST de `graph.delta` como mensaje persistente; snapshot completo cada 10 deltas para que el backfill de 50 baste al que entra tarde | |
| **A6** | Render de exploración, posiciones ancladas, sin re-layout global | |
| **A7** | Documento final por plantilla determinista + síntesis progresiva no bloqueante | |
| **A8** | Script de evaluación parametrizado por lista de tipos | |

## B: La extensión lo hace todo

| Part | Mechanism | Flag |
|------|-----------|:----:|
| **B1** | Channel + presencia + cursores (= A1) | |
| **B2** | Channel extension recibe el batch de mensajes de chat en `onBatch` | |
| **B3** | La extensión llama al LLM desde dentro de `onBatch` y espera el resultado — *el `ExtensionContext` documentado expone solo `ctx.storage`: ni `fetch` ni `env()`* | ⚠️ |
| **B4** | Merge/dedupe/versión del grafo en memoria de la instancia + `ctx.storage` | |
| **B5** | `graph.delta` devuelto como broadcast desde el return de `onBatch` | |
| **B6** | `onSnapshot()` sirve el grafo completo en la trama de conexión | |
| **B7** | Render, documento final y evaluación (= A6, A7, A8) | |

## C: Híbrido — Next.js extrae, la extensión posee el grafo ★ seleccionada

| Part | Mechanism | Flag |
|------|-----------|:----:|
| **C1** | **Sala, transporte y presencia** | |
| C1.1 | Channel de Portal con chat persistente | |
| C1.2 | Presencia (roster de quién está en la sala) | |
| C1.3 | Cursores en vivo: `send({ ephemeral: true })` por pointermove + `setMetadata()` throttled a 250 ms como fallback para el late-join | |
| **C2** | **Extensión dueña del grafo** | |
| C2.1 | `onBatch` sobre el namespace `graph.`: recibe propuestas de extracción | |
| C2.2 | Merge, dedupe por nombre normalizado, versión incremental del grafo | |
| C2.3 | `ctx.storage` para sobrevivir reciclaje de instancia | |
| C2.4 | Emite `graph.delta` como return de `onBatch` | |
| C2.5 | `onSnapshot()` entrega el grafo completo en la trama de conexión | |
| **C3** | **Extractor en Next.js** | |
| C3.1 | Webhook `message.published` → route handler; filtro por namespace y `channelId` en la primera línea | |
| C3.2 | Debounce 3 s; ventana de contexto de 8 turnos; lista completa de nodos existentes en el prompt | |
| C3.3 | Structured output con `enum` sobre el esquema cerrado de 6+6 tipos; guard de idioma | |
| C3.4 | Entrega `graph.proposal` al namespace de la extensión — ver alternativas C3.4-A / C3.4-B | ⚠️ |
| **C4** | **Política de fallo del LLM** | |
| C4.1 | Timeout duro 8 s, un reintento | |
| C4.2 | Descarte del lote con arrastre del turno a la ventana del lote siguiente | |
| C4.3 | Mensaje efímero "el agente se saltó un turno" | |
| **C5** | **Render de exploración** | |
| C5.1 | Posición fija al crear el nodo; force-directed solo local contra vecinos; sin re-layout global | |
| C5.2 | Aristas `SUPPORTS` verdes / `CONTRADICTS` rojas | |
| C5.3 | Arrastre de nodos como estado puramente local, no sincronizado | |
| **C6** | **Notificación de contradicción** | |
| C6.1 | Next.js detecta, sobre la lista de nodos que ya lleva en el prompt, que la propuesta contiene un `CONTRADICTS` hacia un `Claim` con `PROPOSED_BY` al usuario X | |
| C6.2 | Publica un mensaje dirigido con `to: X` por la ruta REST; una regla en `portal.config.ts` devuelve un descriptor de notificación y lo convierte en item de inbox | |
| **C7** | **Documento final** | |
| C7.1 | Plantilla determinista: decisiones con cadena de soporte, contradicciones sin resolver, `Question` sin arista `ANSWERS` = lo que quedó abierto | |
| C7.2 | Síntesis por modelo grande disparada al cerrar, no bloqueante; el markdown se muestra completo y el párrafo se inserta al llegar | |
| **C8** | **Evaluación** | |
| C8.1 | Gold: debate propio de ~8 min en inglés, anotado por Opus y revisado a mano, congelado | |
| C8.2 | Script de matching normalizado por conjuntos, parametrizado por lista de tipos, reporta con y sin tipo | |
| **C9** | **Deploy y operación de demo** | |
| C9.1 | Next.js en Railway (crédito de prueba, sin cold starts, sin túnel) | |
| C9.2 | Extensión desplegada vía `portal.config.ts` | |

---

## C3.4: Cómo llega la propuesta al namespace de la extensión

Superficie confirmada leyendo el bundle publicado de `@portalsdk/core`:

- Host: `https://api.useportal.co` · realtime: `wss://realtime.useportal.co` (`DEFAULT_API_URL` / `DEFAULT_REALTIME_URL`).
- Rutas que llama el cliente: `POST /v1/tokens/anonymous`, `POST /v1/channels/{id}/messages`, `GET .../history`, `GET .../members`.
- Auth: `authorization: Bearer <token>` + `x-portal-key: <pk_...>`. El token anónimo se acuña con solo la publishable key.
- **Los mensajes persistentes van por HTTP POST; los efímeros y los tipos de extensión van por frames de WebSocket**, usando la routing table `bindings` que llega en el frame `ready`.

| Alt | Mecanismo | Flag |
|-----|-----------|:----:|
| **C3.4-A** | Next.js hace `POST /v1/channels/{id}/messages` con `type: "graph.proposal"` y confía en que el servidor lo enrute a la extensión | ⚠️ |
| **C3.4-B** | Next.js mantiene un cliente `@portalsdk/core` conectado por WS como participante de servicio, acuña token con la `pk_` y hace `send()` al namespace `graph.` como cualquier cliente | |

**Notas:**
- C3.4-A ⚠️: el SDK enruta los tipos de extensión por WebSocket **en lugar** del POST HTTP. Eso sugiere que el POST no alimenta extensiones. Un 4xx en el test lo confirma y descarta A sin desplegar nada.
- C3.4-B no tiene flag: usa exactamente el camino que el SDK ya usa para llegar a una extensión, con la key que ya tenemos. Cuesta una conexión WS viva en el proceso de Next.js.
- Efecto lateral bueno de B: el agente pasa a ser un participante del canal, no un servicio empujando desde fuera. Refuerza R5.

➡️ **Ir por C3.4-B salvo que el test devuelva 200 y un `console.log` en `onBatch` demuestre que A funciona.**

---

## Fit Check

| Req | Requirement | Status | A | B | C |
|-----|-------------|--------|---|---|---|
| R0 | Convertir una conversación multi-participante en un grafo de conocimiento tipado, sin intervención manual | Core goal | ✅ | ❌ | 🟡 ✅ |
| R1 | Todos los participantes ven el mismo grafo, con el delta de cada mensaje aplicado en ≤5 s p95 | Must-have | ✅ | ❌ | 🟡 ✅ |
| R2 | Quien entra a mitad de sesión ve el grafo completo de inmediato | Must-have | ✅ | ✅ | ✅ |
| R3 | La calidad del grafo es medible contra una referencia anotada, y se mide | Must-have | ✅ | ✅ | ✅ |
| R4 | El sistema sigue funcionando cuando el LLM gratuito tarda de más o falla | Must-have | ✅ | ❌ | ✅ |
| R5 | Portal se usa de forma profunda y relevante, no como simple websocket | Must-have | ❌ | ✅ | ✅ |
| R6 | Al cerrar la sesión se produce documentación automática con lo decidido y lo que quedó abierto | Must-have | ✅ | ✅ | ✅ |
| R7 | Construible por 3 personas en el plazo del hackathon, con paralelismo desde los primeros 30 min | Must-have | ✅ | ❌ | ✅ |
| R8 | La demo en vivo no depende de una laptop, no sufre cold starts y nunca se queda muda ante un fallo | Must-have | ✅ | ✅ | ✅ |

**Notes:**

- **A falla R5**: Portal queda reducido a channels + webhooks + REST. Ningún primitivo profundo carga peso; la extensión no existe.
- **B falla R0 y R1** por B3 ⚠️: no está documentado que el código de una extensión pueda hacer `fetch` saliente ni leer secretos. Sin eso, no hay extracción.
- **B falla R4**: el `await` al LLM vive dentro de `onBatch`, así que un timeout de 8 s bloquea el procesamiento de los batches siguientes. El fallo del LLM se convierte en fallo del canal.
- **B falla R7**: el equipo no conoce el runtime de extensiones; poner el camino crítico entero ahí no permite paralelizar a los 30 min.
- 🟡 **C pasa R0 y R1 al elegir C3.4-B.** El bloqueo original era "no sabemos si el publish REST entra al namespace de una extensión". Leyendo el bundle publicado de `@portalsdk/core` apareció un camino que no depende de esa respuesta: un cliente headless por WS, que es exactamente como el SDK entrega tipos de extensión. Mecanismo conocido, key disponible, flag levantado.
- **C6 ya no tiene flag**: la ruta REST acepta `to?`/`mentions?` y las notificaciones se declaran config-side en `portal.config.ts` devolviendo un descriptor sobre un mensaje del canal. La detección la hace Next.js antes del merge, sobre la lista de nodos que ya tiene en contexto — es aproximada, y para el caso de demo basta.
- **A2/C3.1**: el filtro por namespace en la primera línea no es higiene, es lo que evita que el backend se auto-alimente con sus propios `graph.delta` en bucle infinito.

### Resolución

🟡 **C queda sin ❌ y domina a A en todo.** El unknown que la bloqueaba no se resolvió corriendo el experimento, sino leyendo el bundle publicado del SDK: apareció C3.4-B, un camino que no depende de la pregunta abierta y que usa la key que ya tenemos.

X1-Q1 sigue mereciendo el test —C3.4-A sería más simple si funcionara, sin conexión WS viva en el backend— pero ya **no está en el camino crítico**. El equipo puede empezar a construir C.

Ver `spike.md`.

---

## Gaps

| Flag | Parte | Qué falta saber | Spike |
|------|-------|-----------------|-------|
| ⚠️ | C3.4-A | Si el publish REST entra al namespace de una extensión. Evidencia **en contra**: el SDK enruta tipos de extensión por WS en lugar del POST. Ya no bloquea: C3.4-B es el camino elegido | X1-Q1 |
| ⚠️ | B3 | Si el código de una extensión puede hacer `fetch` saliente y leer secretos. Docs agotados: señal negativa — `ExtensionContext` expone solo `ctx.storage` | X1-Q3 |
| ~~⚠️~~ | ~~C6~~ | **Resuelto desde docs**: `to?`/`mentions?` en la ruta REST + descriptor de notificación en `portal.config.ts` | ~~X1-Q5~~ |

---

## Estado

🟡 Shape seleccionada: **C**, sin ❌. C3.4 resuelto por la alternativa **C3.4-B** (cliente headless `@portalsdk/core` sobre WS).

Breadboard y slicing de C: ver `breadboard.md` (9 slices, V1–V9). X1-Q1 y X1-Q4 se corren en paralelo, ya fuera del camino crítico.
