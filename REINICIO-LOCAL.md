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

A los ~3-5 s (debounce + LLM NVIDIA) el nodo debe aparecer en el canvas de **ambas**
pestañas. El agente muestra "El agente está pensando…" en el chat mientras extrae.

## Si el grafo no se forma

1. `curl http://localhost:3000/api/extractor/report` — si `skipped` sube, el LLM falla
   (revisa `NEXT_NVIDIA_API_KEY`).
2. El webhook requiere que **ngrok esté corriendo** (URL `https://731c-...`). Si ngrok se
   cayó, reinícialo: `npx ngrok http 3000`, copia la NUEVA URL y actualiza
   `portal.config.ts` (webhooks.url) + `npx portal deploy`.
3. Cada vez que se reinicia ngrok gratis, la URL cambia — hay que actualizar la config.

## Estado actual de la config (ya desplegada)

- Webhook: `https://731c-2800-200-f5b0-f9-5815-1c5f-d120-e21d.ngrok-free.app/api/portal/webhook`
- `.env.local`: `NEXT_PUBLIC_PORTAL_API_KEY`, `NEXT_NVIDIA_API_KEY`, `PORTAL_SECRET`,
  `PORTAL_WEBHOOK_SECRET`, `NVIDIA_LLM_MODEL` — todos seteados.
