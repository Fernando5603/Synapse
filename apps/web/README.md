# Synapse web

Cliente Next.js de la sala viva: chat persistente y presencia sobre Portal.

## Requisitos

Las claves van en el **`.env` de la raíz del monorepo**, no en este directorio.
`next.config.mjs` lo carga a mano, porque Next solo mira los `.env` de su propia carpeta.

Poner una copia en `apps/web/.env.local` es una forma conocida de romper el sistema: Next
carga ese fichero **antes** que la config, así que gana sobre el de la raíz, y una clave
que se quedó vieja ahí deja el webhook devolviendo 401 sin decir por qué.

`npm run verify:flow` comprueba justo eso, además del resto de la cadena.

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
