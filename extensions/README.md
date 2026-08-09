# `graph-owner` — la channel extension dueña del grafo

Corre dentro de Portal, una instancia por canal. `portal.config.ts` (en la raíz) la engancha
al template `room-*`; el namespace y el transporte los declara su propio `manifest`.

Por eso el canal de una sala es `room-<slug>` y no el slug pelado: un template de Portal
exige prefijo fijo (`"*"` a secas lo rechaza el deploy). El prefijo se pone en `Room.tsx`.

Desde el ticket 06 es la **fuente de verdad** del sistema: `onBatch` funde cada propuesta
con `mergeProposal` de `@synapse/graph-core`, difunde el `Delta` que sale, persiste el grafo
en `ctx.storage` y lo sirve entero por `onSnapshot` a quien llega tarde.

Tres cosas que no son opcionales y no dan error si se olvidan:

- **Rehidratar antes de tocar el grafo.** Una instancia se recicla en menos de 45 s de
  inactividad y Portal no rehidrata nada por su cuenta (`spike.md`, X1-Q6). La lectura de
  `ctx.storage` se memoiza y se espera desde `onInit`, `onBatch` y `onSnapshot`: un cliente
  que entra a una sala dormida despierta la instancia con un `onSnapshot`.
- **Un delta por propuesta, siempre, aunque esté vacío.** El criterio (a) se mide por
  mensaje, y quien propone usa el delta como acuse de recibo — un `send()` de tipo de
  extensión no tiene otro. Callarse porque el merge no añadió nada se lee como propuesta
  perdida y provoca un reenvío.
- **`snapshotDirty: true` en el batch que cambió el grafo**, o el late-joiner recibe un
  snapshot viejo.

## Desplegar

```powershell
$env:PORTAL_SECRET = "sk_..."    # secret key del entorno, no la pk_
npm run deploy:portal
```

**El CLI no lee `.env`.** Toma `PORTAL_SECRET` del entorno del proceso, así que hay que
exportarla en la shell (una vez por sesión de terminal); ponerla en `.env` no basta.

El despliegue es atómico y no requiere tocar la app: los canales con conexiones activas
mantienen su configuración hasta que reinicien, y las conexiones nuevas usan la versión
recién subida.

**El `✓ Deployed` no es "activo".** Medido en el 06: un canal recién estrenado seguía
contestando con el bundle anterior 40 s después de un deploy. Si acabas de desplegar y ves
el comportamiento viejo, espera un par de minutos y vuelve a probar antes de tocar nada.

## Probarlo sin navegador

Con el dev server levantado (`npm run dev -w web`), el agente headless dispara propuestas
desde el servidor y devuelve el delta con el que contestó la extensión:

```bash
curl "http://localhost:3000/api/agent/propose?room=<sala>"          # propuesta de demo
curl -X POST http://localhost:3000/api/agent/propose \
  -H 'content-type: application/json' \
  -d '{"room":"<sala>","proposal":{"nodes":[…],"edges":[…]}}'        # propuesta a medida
```

Dispararlo dos veces sobre la misma sala es la prueba del dedupe: el segundo delta vuelve
**vacío y con la versión incrementada**. En el navegador sigue estando
`await __synapse.propose()` en la consola de la sala, y el badge `Grafo v<n>` de la barra
izquierda muestra la versión que sirve la extensión.

`internal/probe-graph06.mjs` hace la corrida entera —dedupe, reciclaje de instancia,
late-join y convergencia de las dos pantallas— sin navegador.

## Contrato

Los tipos que viajan por el namespace son los de `@synapse/graph-core`:

| Tipo de mensaje | Dirección | Contenido |
|---|---|---|
| `graph.proposal` | cliente/backend → extensión | `Proposal` |
| `graph.delta` | extensión → todo el canal | `Delta` |
| `ext.graph` (trama de conexión) | extensión → quien conecta | `GraphSnapshot` = `{ graph, instance }` |

El contenido de un `graph.proposal` es `unknown` —Portal no lo mira— y lo que la extensión
persiste y difunde sale de ahí: pasa por `sanitizeProposal` antes de tocar el grafo. El
`instance` del snapshot (`{ epoch, rehydrated, batches }`) es **diagnóstico**: es la única
ventana a una extensión desplegada, porque no existe `portal logs`. Nada del producto debe
leerlo.

**El contrato de datos está congelado** desde que este ticket aterrizó: cambiarlo requiere
acuerdo de los tres.
