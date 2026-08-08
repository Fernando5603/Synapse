# Synapse web

Cliente Next.js de la sala viva: chat persistente y presencia sobre Portal.

## Requisitos

- `NEXT_PUBLIC_PORTAL_API_KEY`: publishable key de Portal (`pk_...`). Es segura en el
  bundle del navegador. Copia `.env.example` a `.env.local` y rellena el valor.

## Desarrollo

```sh
npm run dev -w web
```

## Deploy en Railway

`railway.json` configura build y start. **Para cumplir el "sin cold start" del ticket 02,
la escala mínima debe ser ≥1 réplica** — eso se configura en el dashboard de Railway
(Deployments → Settings → Scale), no en `railway.json`. Sin ese ajuste, el primer mensaje
de una sesión inactiva espera a que la instancia arranque.

La app usa Portal en modo anónimo: el SDK acuña una identidad anónima estable **por
perfil de navegador**. Para la demo de "tres pestañas que se ven en el roster", usa tres
perfiles/ventanas de incógnito distintos — tres pestañas del mismo perfil son un solo
participante.
