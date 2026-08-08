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
| **X1-Q4** | ¿Cuál es el ciclo editar → desplegar → probar de una extensión, y cuánto tarda? | Abierta. Es lo que determina si iterar sobre la extensión es viable bajo presión |
| **X1-Q5** | ¿Cuál es la API de inbox / notificaciones in-app, y qué hace falta para emitir una notificación dirigida a un usuario concreto desde código de servidor? | **Respondida.** No hay endpoint suelto: la ruta REST acepta `to?`/`mentions?`, y una regla en `portal.config.ts` devuelve un descriptor de notificación sobre el mensaje del canal |
| **X1-Q6** | Cuando una instancia de extensión se recicla, ¿qué se rehidrata solo desde `ctx.storage` y qué hay que reconstruir a mano en `onInit`? | Abierta |

## Acceptance

El spike está completo cuando podemos describir: por dónde entra un mensaje server-side al namespace de una extensión; si el LLM puede ejecutarse dentro de la extensión; cuánto tarda un ciclo de despliegue de extensión; cómo se emite una notificación dirigida; y qué sobrevive al reciclaje de instancia.

## Reparto

X1-Q1 a X1-Q4 los corre quien lleva el backend, y no escribe nada más hasta tener resultado.
X1-Q5 y X1-Q6 pueden esperar a que Q1 esté respondida: solo importan si C sigue en pie.

Mientras tanto, frontend monta sala, chat y presencia contra deltas falsos, y el tercero graba, transcribe y anota el debate de evaluación.
