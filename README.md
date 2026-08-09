# Synapse

Un **lienzo colaborativo con grafo de conocimiento en vivo**. Tres personas entran a una sala, chatean sobre una decisión técnica, y mientras hablan un grafo tipado se construye solo a su lado — cada mensaje produce un delta que aparece en las tres pantallas en segundos. Al cerrar la sesión, el sistema genera un documento markdown con lo decidido, lo que quedó en disputa y lo que quedó abierto.

Construido para un hackathon de 3 personas, con los criterios de éxito definidos en `goal.md` (a)/(b)/(c): latencia de delta ≤5s p95, calidad medible contra un gold anotado, y documentación automática de cierre.

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Cliente / UI | **Next.js 14** (App Router), **React 18**, **TypeScript**, **Tailwind CSS** |
| Canvas del grafo | **D3** (`d3-force`, `d3-zoom`, `d3-selection`, `d3-transition`) |
| Realtime / presencia | **Portal** (`@portalsdk/core` + `@portalsdk/react`) — channels, presencia, cursores efímeros, inbox |
| Extensiones de Portal | **channel extension** `graph-owner` (el grafo autoritativo vive en un primitivo de Portal) |
| LLM de extracción | **Groq** (`llama-3.3-70b-versatile`) con structured output JSON |
| Lógica pura | **`@synapse/graph-core`** — paquete sin dependencias de runtime, compartido por cliente, backend y extensión |
| Evaluación | **`@synapse/eval`** — CLI de precisión/recall contra el gold |
| Tests | **Vitest** |
| Deploy | **Railway** (`apps/web/railway.json`) |
| Monorepo | **npm workspaces** (`packages/*`, `apps/*`) |

---

## Arquitectura

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Cliente Next.js (apps/web) │        │  Plataforma Portal (nube)    │
│  - Sala, chat, canvas       │◄──────►│  - channel room-<slug>       │
│  - presencia, cursores      │  WS/    │  - presence, cursores       │
│  - documento final          │  REST   │  - webhooks (message.*)     │
└──────────────┬──────────────┘        └───────────┬──────────────────┘
               │                                  │  channel extension
               │                                  ▼  graph-owner
               │                     ┌──────────────────────────────┐
               │                     │  Extensión (extensions/)      │
               │                     │  - dueña del grafo autoritativo│
               │                     │  - merge/dedupe/versión        │
               │                     │  - ctx.storage (persistencia)  │
               │                     │  - onSnapshot (late-join)      │
               │                     └──────────────────────────────┘
               │
┌──────────────▼──────────────┐
│  Backend Next.js (apps/web) │
│  - webhook message.published│
│  - debounce 3s + buffer     │
│  - prompt (8 turnos + nodos)│
│  - LLM Groq (structured out)│
│  - cliente headless (agent) │
│  - espejo del grafo         │
└─────────────────────────────┘
```

### Tres procesos

1. **Cliente Next.js** — la sala: chat persistente, canvas del grafo, presencia, cursores en vivo y el documento final.
2. **Backend Next.js** — route handlers del webhook y del cierre, buffer de turnos con debounce, llamada al LLM, detección de contradicción, y un cliente headless de Portal (`apps/web/lib/agent.ts`) que entra al canal como participante «Synapse».
3. **Channel extension `graph-owner`** — dueña del grafo autoritativo: recibe propuestas, las mergea, persiste en `ctx.storage`, emite el delta y sirve el grafo entero al que entra tarde.

### El seam: `@synapse/graph-core`

Todo el comportamiento determinista vive en un paquete puro **sin imports de Portal, `fetch`, `Date` ni Next.js**. Compartido por cliente, backend y extensión:

```
mergeProposal(graph, proposal)        -> { graph, delta }
applyDelta(graph, delta)              -> graph
detectContradiction(graph, proposal, authorId) -> { targetUserId, claimId } | null
renderDocument(graph)                 -> string
normalizeName(name)                   -> string (normalización para dedupe y matching)
```

### Contrato de datos (congelado)

```
Node     = { id, type: EntityType, name, proposedBy?: userId }
Edge     = { id, type: RelationType, from: nodeId, to: nodeId }
Graph    = { nodes: Node[], edges: Edge[], version: number }
Proposal = { nodes: Omit<Node,"id">[], edges: {type, from: name, to: name}[] }
Delta    = { addedNodes: Node[], addedEdges: Edge[], version: number }
```

- `EntityType`: `Claim` · `Concept` · `Question` · `Evidence` · `Person` · `Decision`
- `RelationType`: `SUPPORTS` · `CONTRADICTS` · `ELABORATES` · `ANSWERS` · `PROPOSED_BY` · `RESOLVES`
- Las `Proposal` refieren nodos **por nombre** (el LLM no conoce ids); resolver nombre→id es trabajo de `mergeProposal`.
- Un `Delta` vacío es válido y se emite con la versión incrementada.

---

## Flujo end-to-end

```
1. Un participante escribe un mensaje en el chat.
2. Portal lo persiste en el canal y dispara el webhook `message.published`.
3. El backend recibe el webhook, filtra por namespace/channelId (corta el bucle de
   auto-alimentación), acumula el turno en el buffer.
4. Tras 3s sin mensajes nuevos, arma el prompt: los últimos 8 turnos + la lista
   completa de nodos existentes (desde el espejo del grafo).
5. Llama al LLM de Groq con structured output (JSON con nodos y aristas del esquema 6+6).
6. Sanitiza la salida (`sanitizeProposal`): lo que no cumple el esquema se descarta.
7. El agente headless entrega la `graph.proposal` a la extensión por WebSocket.
8. La extensión mergea, deduplica por nombre normalizado, persiste y devuelve el delta.
9. El delta se difunde al canal y el cliente lo aplica — el grafo aparece en las 3 pantallas.
10. Al cerrar la sesión, `renderDocument` genera el markdown desde el grafo autoritativo.
```

### Política de fallo del LLM

- Timeout duro en el cliente LLM (fetch aborta a 7s) + **un reintento** (`retries: 1`).
- Si el lote falla (LLM o entrega), los turnos se **arrastran** a la ventana siguiente — no se pierde contenido.
- El estado se comunica con efímeros del agente (`agent.thinking` / `agent.skipped`) que el cliente pinta como banners — **el fallo nunca es silencio ni cuelgue**.
- El pipeline expone `report()` con p95 y % de descartes; `GET /api/extractor/report` los sirve.

---

## Repositorio

```
├── apps/
│   └── web/                  # Cliente + backend Next.js
│       ├── app/              # Páginas (sala) y API routes (webhook, propose, report)
│       ├── components/       # ChatPanel, GraphCanvas, SessionDoc, PresenceBar, ...
│       └── lib/
│           ├── extract/      # Pipeline del extractor (filtro, buffer, prompt, llm, espejo)
│           ├── agent.ts      # Cliente headless de Portal (participante «Synapse»)
│           └── display/cursor/layout/...  # Seams puros de UI
├── extensions/
│   └── graph-owner.ts        # Channel extension: dueña del grafo
├── packages/
│   ├── graph-core/           # Lógica pura: merge, delta, guards, documento, contradicción
│   └── eval/                 # CLI de evaluación (precisión/recall vs gold)
├── gold/                     # El gold anotado (debate + entidades + relaciones)
├── issues/                   # Roadmap de tickets (01..13)
├── scripts/                  # Utilidades (webhook-secret, verificar-flujo)
├── portal.config.ts          # Config de Portal (webhook, extensión, notify)
└── goal/spec/shaping/breadboard/spike/  # Documentación de diseño
```

---

## Requisitos

- Node.js ≥ 20
- Cuenta en **Portal** (useportal.co) → publishable key `pk_...`, secret key `sk_...`
- Cuenta en **Groq** (console.groq.com) → API key `gsk_...`

## Configuración

Copia `.env.example` a `apps/web/.env.local` (y crea `.env` en la raíz si lo necesitas para el CLI):

```bash
# apps/web/.env.local
NEXT_PUBLIC_PORTAL_API_KEY=pk_...          # publishable key de Portal (segura en el bundle)
NEXT_GROQ_API_KEY=gsk_...                  # API key de Groq (server-side)
GROQ_LLM_MODEL=llama-3.3-70b-versatile    # modelo del extractor
PORTAL_SECRET=sk_...                       # secret key de Portal (para el CLI)
PORTAL_WEBHOOK_SECRET=whsec_...            # secreto de firma del webhook (npm run webhook:secret)
PORTAL_WEBHOOK_ORIGIN=                     # local: tu URL de ngrok, prod: la URL de Railway
```

Obtén el secreto del webhook con la secret key:

```bash
npm run webhook:secret
```

### Despliegue de la config de Portal

`portal.config.ts` define el webhook, la extensión y las notificaciones. Desplegarla con:

```bash
npm run deploy:portal
```

> En local, el webhook necesita que Portal pueda alcanzar tu app: levanta un túnel
> (ngrok) hacia el 3000 y apunta `PORTAL_WEBHOOK_ORIGIN` a su URL antes de desplegar.
> En producción, apunta a la URL de Railway.

---

## Desarrollo

```bash
npm install          # instala workspaces
npm run dev:web      # dev server en http://localhost:3000
```

Abre `http://localhost:3000` → escribe el nombre de la sala → tu nombre → chatea.
Para que el grafo se forme en local necesitas el webhook alcanzable (ngrok + deploy).

### Tests

```bash
npm test             # suite completa (Vitest)
npm run test:graph-core
npm run test:web
npm run test:eval
npm run typecheck    # typecheck de todos los workspaces + la extensión
```

### Evaluación contra el gold (criterio b)

```bash
npm run eval -- --gold gold/gold.json --graph <grafo-extraido.json> --types Claim,Concept,Question,Evidence,Person,Decision
```

Reporta precisión/recall de entidades y relaciones, con y sin tipo, y el veredicto del criterio (b).

### Verificar el flujo end-to-end

```bash
npm run verify:flow
```

---

## Deploy en Railway

`apps/web/railway.json` configura build y start. **Para cumplir el «sin cold start», la escala mínima debe ser ≥1 réplica** — se configura en el dashboard de Railway, no en el JSON.

---

## Documentación de diseño

- `goal.md` — criterio de éxito (a)/(b)/(c) y verificación.
- `spec.md` — spec listo para agentes (historias, decisiones, testing).
- `shaping.md` — requirements R0-R8 y la elección de la shape C.
- `breadboard.md` — afordances y slices V1-V9.
- `spike.md` — unknowns de la superficie server-side de Portal.
- `AGENTS.md` — guía para agentes de IA que trabajen en el repo.
- `issues/` — roadmap de tickets (01..13), con estado.

## Licencia

MIT
