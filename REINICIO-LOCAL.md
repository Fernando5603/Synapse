# Reinicio del flujo local: grafo que se forma hablando

Todo el andamiaje quedó configurado. Solo falta reiniciar el dev server con el
`.next` limpio. Haz esto en tu terminal:

## 1. Detén tu dev server actual (Ctrl+C en la terminal donde corre `npm run dev:web`)

## 2. Verifica que el puerto 3000 quedó libre

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
```

Si algo sigue ahí, mátalo: `Stop-Process -Id <PID> -Force` (por el PID que diga).

## 3. Arranca el dev server de nuevo

```powershell
cd D:\SYNAPSE\Synapse
npm run dev:web
```

Espera a que diga `✓ Ready`. El `.next` limpio se recompila solo.

## 4. Verifica que responde

En otra terminal:

```powershell
curl http://localhost:3000/
curl http://localhost:3000/api/extractor/report
```

Ambos deben devolver 200.

## 5. Abre la sala en dos pestañas/ventanas de incógnito distintas

```
http://localhost:3000/room/inteligencia
```

Dos **perfiles/ventanas de incógnito distintos** (una normal + una incógnito, o dos
perfiles) — tres pestañas del mismo perfil son UN solo participante.

## 6. Escribe en una pestaña

Un mensaje como:

> The latency matters because the debounce eats the budget, so we need a hybrid pipeline.

A los ~3-5 s (debounce + LLM Groq) el nodo debe aparecer en el canvas de **ambas**
pestañas. El agente muestra "El agente está pensando…" en el chat mientras extrae.

## Si el grafo no se forma

**Primero, siempre:**

```powershell
curl http://localhost:3000/api/extractor/report
```

Devuelve `listo: true/false` y qué clave falta. Las dos formas de quedarse sin nodos son
mudas por diseño —sin `NEXT_GROQ_API_KEY` el extractor se construye en su version que
siempre falla, sin `PORTAL_WEBHOOK_SECRET` el webhook rechaza cada POST— y las dos dejan
la sala funcionando con el grafo vacio.

Si dice `listo: false`:

1. **Las claves van en el `.env` de la raiz.** `next.config.mjs` lo carga; no hace falta
   duplicarlas en `apps/web/.env.local`.
2. **`PORTAL_WEBHOOK_SECRET` no existe hasta que hay un webhook registrado.** El orden es:
   ```powershell
   npx ngrok http 3000            # copia la URL https que imprime
   # pegala en webhooks.url de portal.config.ts
   npx portal deploy
   npm run webhook:secret         # la trae y la escribe en el .env de la raiz
   ```
   Y reinicia el dev server para que la lea.
3. **La key y el endpoint tienen que ser del mismo proveedor.** Una key de Groq (`gsk_`)
   contra el endpoint de NVIDIA —o al reves— da 401 en cada lote y el grafo se queda
   vacio sin un error a la vista. El endpoint lo avisa en `providerMatches`.
4. **Groq limita por tokens por minuto, no por peticiones** (12.000 TPM en
   `llama-3.3-70b-versatile`). Una conversacion muy viva puede topar: el lote devuelve 429,
   se descarta y se arrastra segun la politica del 08, asi que se ve como `skipped`
   subiendo sin que el modelo este mal. `internal/probe-groq.mts` imprime el margen que
   queda.

Si dice `listo: true` y aun asi no hay nodos, mira `lotes`: si `skipped` sube, el LLM esta
fallando y la consola del dev server lo dice; si no sube nada, el webhook no llega (ngrok
caido, o la URL desplegada no es la de ahora).
