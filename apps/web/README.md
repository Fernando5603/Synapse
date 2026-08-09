# Synapse web

Cliente Next.js de la sala viva: chat persistente y presencia sobre Portal.

## Requisitos

- `NEXT_PUBLIC_PORTAL_API_KEY`: publishable key de Portal (`pk_...`). Es segura en el
  bundle del navegador. Copia `.env.example` a `.env.local` y rellena el valor.

## Desarrollo

```sh
npm run dev -w web
```

## El agente del canal

El backend mantiene un cliente headless de Portal conectado a cada sala en la que trabaja
(`lib/agent.ts`). Entra como participante anónimo y aparece en el roster como «Synapse»,
así que la extensión no lo distingue de una persona.

Mientras no haya LLM, la propuesta se dispara a mano:

```sh
curl "http://localhost:3000/api/agent/propose?room=<sala>"
```

La respuesta trae el `graph.delta` con el que contestó la extensión. `ok: false` con
`delta: null` significa que la propuesta salió y nadie contestó — ahí el sospechoso es la
extensión o el par de claves, no el transporte.

Usa la misma `NEXT_PUBLIC_PORTAL_API_KEY` que el navegador, y no por comodidad: la extensión
solo existe para los clientes cuya `pk_` es del mismo entorno de Portal que la `sk_` con la
que se desplegó. Con claves cruzadas todo funciona menos las extensiones, y sin ningún error.

## Deploy en Railway

`railway.json` configura build y start. **Para cumplir el "sin cold start" del ticket 02,
la escala mínima debe ser ≥1 réplica** — eso se configura en el dashboard de Railway
(Deployments → Settings → Scale), no en `railway.json`. Sin ese ajuste, el primer mensaje
de una sesión inactiva espera a que la instancia arranque.

La app usa Portal en modo anónimo: el SDK acuña una identidad anónima estable **por
perfil de navegador**. Para la demo de "tres pestañas que se ven en el roster", usa tres
perfiles/ventanas de incógnito distintos — tres pestañas del mismo perfil son un solo
participante.
