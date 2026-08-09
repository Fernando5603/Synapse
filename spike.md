---
shaping: true
---

# X1 Spike: Superficie server-side de las channel extensions de Portal

## Context

La shape seleccionada (C en `shaping.md`) apoya su camino crítico en que el backend de Next.js publique una `graph.proposal` por REST **hacia el namespace de una channel extension**, y que la extensión la consuma en `onBatch`. La documentación de Portal dice que los clientes envían a ese namespace con `send()`, y no aclara si el publish REST del servidor cuenta como tal.

Mientras eso no se sepa, C3.4 está flagged y C falla R0 y R1 en el fit check. La shape de respaldo (A) no usa extensiones en absoluto y falla R5, que es criterio del jurado.

Este spike es la primera tarea del hackathon, antes de escribir código de producto.

## Goal

Saber por dónde puede entrar un mensaje generado en el servidor al namespace de una extensión, si el LLM podría vivir dentro de la propia extensión, cuánto dura el ciclo de despliegue de una extensión, y cómo se emite una notificación dirigida al inbox de un usuario.

## Questions

| # | Question | Estado desde docs |
|---|----------|-------------------|
| **X1-Q1** | ¿Puede el publish REST del servidor entregar un mensaje en el namespace de una extensión, de modo que llegue a `onBatch`? | **Señal en contra.** El bundle de `@portalsdk/core` enruta los efímeros y los tipos de extensión por frames de WebSocket **en lugar** del POST HTTP, usando la routing table `bindings` del frame `ready`. Ya no bloquea: es solo una optimización que ahorraría la conexión WS del backend |
| **X1-Q2** | ¿Qué caminos quedan para que código server-side inyecte un mensaje en ese namespace? | **Respondida — y es el camino elegido (C3.4-B).** Cliente headless `@portalsdk/core` en Node (el paquete se describe como "transport-agnostic client runtime"), token anónimo acuñado con la `pk_` vía `POST /v1/tokens/anonymous`, y `send()` al namespace `graph.` |
| **X1-Q3** | ¿Puede el código de una extensión hacer `fetch` saliente a un tercero, y leer un secreto definido con `portal secrets set`? | **Señal negativa.** El `ExtensionContext` documentado expone solo `ctx.storage`; no aparece `fetch` ni `env()`. Decide si B es viable — no bloquea a C |
| **X1-Q4** | ¿Cuál es el ciclo editar → desplegar → probar de una extensión, y cuánto tarda? | **Respondida al construir el ticket 04.** `portal deploy` tarda segundos; el ciclo real son minutos y tiene tres trampas. Ver abajo |
| **X1-Q5** | ¿Cuál es la API de inbox / notificaciones in-app, y qué hace falta para emitir una notificación dirigida a un usuario concreto desde código de servidor? | **Respondida.** No hay endpoint suelto: la ruta REST acepta `to?`/`mentions?`, y una regla en `portal.config.ts` devuelve un descriptor de notificación sobre el mensaje del canal |
| **X1-Q6** | Cuando una instancia de extensión se recicla, ¿qué se rehidrata solo desde `ctx.storage` y qué hay que reconstruir a mano en `onInit`? | **Medido a medias en el ticket 04**: el reciclaje llega en **menos de 45 s** de inactividad. Qué rehidrata sigue abierto. Ver abajo |

## X1-Q4 — el ciclo de una extensión, medido al construir el ticket 04

`portal deploy` responde en segundos. Ese número es el que no importa: el ciclo real de
editar → desplegar → **probar** son varios minutos, y lo que lo alarga son tres trampas que
se manifiestan todas igual — no pasa nada y no hay ningún error.

1. **La `pk_` del cliente y la `sk_` del deploy tienen que ser del mismo entorno.** Un
   proyecto de Portal tiene **dos entornos**, cada uno con su par de claves. Si no coinciden,
   el deploy funciona, el canal funciona, el chat y la presencia funcionan —nada de eso
   depende del config— y las extensiones sencillamente no existen para ese cliente. Es el
   fallo que costó la tarde del ticket 04.

   **Cómo comprobarlo en un minuto**: despliega un canal con `anonymous: false` y conéctate
   con la `pk_`. Si entra, las claves son de entornos distintos. Es el único efecto del
   config observable sin extensiones.

2. **Un canal conserva su configuración mientras tenga conexiones vivas.** El propio CLI lo
   avisa. En la práctica: cada prueba exige cerrar **todas** las pestañas y estrenar nombre
   de sala. Un canal que ya existía nunca ve el deploy nuevo.

3. **El CLI compara el config evaluado, no el texto del fichero.** Añadir un comentario a
   `portal.config.ts` no fuerza nada: responde `is unchanged — activated the existing
   version`. Un cambio semántico (renombrar el handle, añadir una entrada) sí. *Sin
   comprobar*: si editar **solo** el fichero de la extensión, sin tocar el config, vuelve a
   subir el bundle. Asúmelo que no hasta que alguien lo verifique.

**No hay forma de observar una extensión desde fuera.** No existe `portal logs` ni una
consulta del tipo "qué extensiones tiene este canal". Las dos únicas señales son si vuelve
una respuesta y el `ext` de `ChannelSnapshot`, que solo se puebla si la extensión implementa
`onSnapshot`. Corolario para los tickets 06 y 08: **darle un `onSnapshot` a la extensión
desde el principio**, aunque devuelva una tontería, es lo que la vuelve observable.

Instrumentos que sí sirven, los dos del propio CLI:

- `portal listen <channelId> --key pk_...` — imprime cada mensaje que entra al canal, desde
  fuera del navegador. Distingue "el cliente no envía" de "la extensión no contesta".
- Un script de nueve líneas con `@portalsdk/core` que conecte e imprima
  `getSnapshot().ext` — dice si la extensión está viva sin enviar nada.

## X1-Q6 — cada cuánto se recicla una instancia (medido en el ticket 04)

La extensión del ticket 04 lleva un contador de versión en un campo de instancia, sin
`ctx.storage`. Dos propuestas al mismo canal, variando solo la espera entre ellas:

| Espera entre propuestas | Versiones devueltas |
|---|---|
| 5 s | `1`, `2` — el campo sobrevive |
| 45 s | `1`, `1` — el campo se perdió |

**Una instancia pierde su memoria en menos de 45 segundos de inactividad.** El README de
`@portalsdk/extension-protocol` dice que los campos de instancia persisten entre
invocaciones y que las instancias se reciclan "cuando el canal lleva suficiente tiempo
inactivo"; lo que no dice es que "suficiente" son segundos.

Consecuencia directa para el ticket 06, y es la que importa: **`ctx.storage` no es una red
de seguridad contra el reciclaje del proceso, es la única memoria que la extensión tiene
entre un turno de conversación y el siguiente.** En una discusión real la gente calla más de
45 segundos constantemente. Un grafo que viva solo en un campo de instancia se vacía a mitad
de sesión, y el síntoma sería un grafo que "olvida" en vez de un error.

Sigue abierto qué rehidrata Portal por su cuenta al reciclar y qué hay que reconstruir en
`onInit` — pero la pregunta ya no es si hace falta persistir: es cuándo.

## Acceptance

El spike está completo cuando podemos describir: por dónde entra un mensaje server-side al namespace de una extensión; si el LLM puede ejecutarse dentro de la extensión; cuánto tarda un ciclo de despliegue de extensión; cómo se emite una notificación dirigida; y qué sobrevive al reciclaje de instancia.

## Reparto

X1-Q1 a X1-Q4 los corre quien lleva el backend, y no escribe nada más hasta tener resultado.
X1-Q5 y X1-Q6 pueden esperar a que Q1 esté respondida: solo importan si C sigue en pie.

Mientras tanto, frontend monta sala, chat y presencia contra deltas falsos, y el tercero graba, transcribe y anota el debate de evaluación.
