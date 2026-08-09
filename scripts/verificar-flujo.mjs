/**
 * Comprueba la cadena entera: mensaje de chat → webhook → LLM → extensión → delta.
 *
 *     npm run verify:flow
 *
 * Existe porque cada eslabón de esta cadena falla **en silencio** por diseño: el webhook
 * responde 2xx aunque no procese, el extractor devuelve `undefined` en vez de lanzar, y
 * el agente arrastra el lote en vez de romper la sala. El síntoma de todos es el mismo —
 * la sala funciona y el grafo no crece— así que hace falta algo que diga en qué eslabón.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac } from "node:crypto";
import { Portal } from "@portalsdk/core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
);

// `127.0.0.1` y no `localhost`: el `fetch` de Node resuelve primero a `::1`, y el dev
// server de Next escucha en IPv4 — con `localhost` el script se cae con "no contesta"
// mientras el servidor está perfectamente vivo.
const base = process.env.SYNAPSE_URL ?? "http://127.0.0.1:3000";
let fallos = 0;

/**
 * Claves duplicadas entre el `.env` de la raíz y el de la app.
 *
 * Va lo primero porque es el fallo más caro de los que hay aquí: Next carga su
 * `.env.local` **antes** que `next.config.mjs`, así que una copia vieja en `apps/web`
 * gana sobre la buena de la raíz y no lo dice nadie. Con `PORTAL_WEBHOOK_SECRET` eso son
 * 401 en cada entrega, con el grafo vacío como único síntoma.
 */
function claves(ruta) {
  try {
    return Object.fromEntries(
      readFileSync(resolve(root, ruta), "utf8")
        .split(/\r?\n/)
        .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
        .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
    );
  } catch {
    return {};
  }
}

function paso(ok, titulo, detalle) {
  console.log(`${ok ? "  OK  " : "  MAL "} ${titulo}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) {
    fallos += 1;
  }
  return ok;
}

const sombra = Object.entries(claves("apps/web/.env.local")).filter(
  ([clave, valor]) => env[clave] !== undefined && env[clave] !== valor,
);
paso(
  sombra.length === 0,
  "ninguna clave de apps/web/.env.local tapa una distinta de la raíz",
  sombra.length === 0 ? undefined : `bórralas de apps/web/.env.local: ${sombra.map(([c]) => c).join(", ")}`,
);

// 1. ¿Está el servidor y con qué claves?
let report;
try {
  report = await (await fetch(`${base}/api/extractor/report`)).json();
} catch (cause) {
  console.error(`No contesta ${base}. ¿Está corriendo \`npm run dev:web\`?`);
  process.exit(1);
}
paso(report.config.llmApiKey, "NEXT_GROQ_API_KEY cargada");
paso(report.config.webhookSecret, "PORTAL_WEBHOOK_SECRET cargada");
paso(
  report.config.providerMatches,
  "la key del LLM y el endpoint son del mismo proveedor",
  `${report.config.model} @ ${report.config.baseUrl}`,
);

// 2. ¿El secreto que tiene el servidor en memoria es el que hay hoy en el .env?
//    Es el fallo que no se ve: basta reiniciar el server después de escribir el .env.
const cuerpo = JSON.stringify({
  id: `m_verify_${Date.now()}`,
  type: "message.published",
  channelId: "room-verificacion",
  data: { type: "ping.verificacion", content: {}, sender: { id: "u_verify" }, ephemeral: false },
});
const t = Math.floor(Date.now() / 1000);
const firma = createHmac("sha256", env.PORTAL_WEBHOOK_SECRET ?? "").update(`${t}.${cuerpo}`).digest("hex");
const firmado = await fetch(`${base}/api/portal/webhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "portal-signature": `t=${t},v1=${firma}` },
  body: cuerpo,
});
paso(
  firmado.status !== 401,
  "el servidor acepta la firma del .env de ahora",
  firmado.status === 401 ? "reinicia el dev server: arrancó con otro secreto" : `HTTP ${firmado.status}`,
);

// 3. La cadena de verdad, con un turno real.
const sala = `room-verify${Date.now()}`;
const canal = new Portal({ apiKey: env.NEXT_PUBLIC_PORTAL_API_KEY }).channel(sala, {
  history: "none",
  metadata: { displayName: "Verificador" },
});
const deltas = [];
canal.on("message", (m) => {
  if (m.type === "graph.delta") {
    deltas.push(m.content);
  }
});
canal.acquire();
await new Promise((r) => setTimeout(r, 4000));
paso(canal.status === "ready", "el canal de Portal conecta", canal.status);

console.log(`\n  mandando un turno a ${sala}…`);
await canal.send({
  content: { text: "The latency matters more than perfection here, because the debounce eats the budget." },
});

// debounce (3 s) + LLM (~3 s) + entrega. 25 s es holgado.
for (let i = 0; i < 25 && deltas.length === 0; i += 1) {
  await new Promise((r) => setTimeout(r, 1000));
}

const despues = await (await fetch(`${base}/api/extractor/report`)).json();
const lotes = despues.lotes;
if (
  !paso(
    lotes.completed + lotes.skipped > report.lotes.completed + report.lotes.skipped,
    "el webhook llegó al pipeline",
    "si no: mira la URL desplegada (¿lleva /api/portal/webhook?) y si ngrok sigue vivo",
  )
) {
  // nada más que mirar aguas abajo
} else {
  paso(lotes.skipped === report.lotes.skipped, "el LLM contestó", `${lotes.skipped} descartes en total`);
}
paso(deltas.length > 0, "volvió un graph.delta de la extensión");
for (const d of deltas) {
  console.log(`       v${d.version}: ${d.addedNodes.map((n) => `${n.type}:${n.name}`).join(", ")}`);
}

canal.release();
console.log(fallos === 0 ? "\nLa cadena entera funciona." : `\n${fallos} eslabón(es) roto(s).`);
process.exit(fallos === 0 ? 0 : 1);
