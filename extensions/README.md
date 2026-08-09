# `graph-owner` — la channel extension dueña del grafo

Corre dentro de Portal, una instancia por canal. `portal.config.ts` (en la raíz) la engancha
al template `room-*`; el namespace y el transporte los declara su propio `manifest`.

Por eso el canal de una sala es `room-<slug>` y no el slug pelado: un template de Portal
exige prefijo fijo (`"*"` a secas lo rechaza el deploy). El prefijo se pone en `Room.tsx`.

Hoy **miente a propósito**: `onBatch` ignora el contenido de la propuesta y devuelve siempre
el mismo delta, con la versión subiendo una vez por batch. El merge real llega con el ticket
06, junto con `ctx.storage` y `onSnapshot`.

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

## Probarlo sin backend

El backend todavía no participa del canal (eso es el ticket 05). La sala asoma un disparador
en la consola del navegador:

```js
await __synapse.propose()
```

Eso publica una `graph.proposal` al namespace `graph.`. La extensión responde con su
`graph.delta`, y los nodos y la arista aparecen en **todas** las pestañas abiertas en la
misma sala, no solo en la que disparó. El badge `Grafo v<n>` de la barra izquierda sube con
cada disparo.

## Contrato

Los tipos que viajan por el namespace son los de `@synapse/graph-core`:

| Tipo de mensaje | Dirección | Contenido |
|---|---|---|
| `graph.proposal` | cliente/backend → extensión | `Proposal` |
| `graph.delta` | extensión → todo el canal | `Delta` |

**El contrato de datos está congelado** desde que este ticket aterrizó: cambiarlo requiere
acuerdo de los tres.
