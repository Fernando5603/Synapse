/**
 * Trae el secreto de firma de los webhooks de Portal y lo deja en el `.env` de la raíz.
 *
 *     npm run webhook:secret
 *
 * Se ejecuta **después** de `npx portal deploy`, no antes: el secreto no existe hasta que
 * hay un webhook registrado, y `portal deploy` es lo que lo registra desde el
 * `webhooks.url` de `portal.config.ts`. Sin él, la ruta del webhook rechaza cada POST y
 * la sala se queda sin nodos sin decir por qué.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");

if (!existsSync(envPath)) {
  console.error("No hay .env en la raíz. Copia .env.example y pon las claves.");
  process.exit(1);
}

const raw = readFileSync(envPath, "utf8");
const values = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
);

const secretKey = values.PORTAL_SECRET;
if (!secretKey) {
  console.error("Falta PORTAL_SECRET (sk_…) en el .env de la raíz.");
  process.exit(1);
}

const response = await fetch("https://api.useportal.co/v1/webhooks/secret", {
  headers: { Authorization: `Bearer ${secretKey}` },
});
const body = await response.text();

if (!response.ok) {
  console.error(`Portal contestó ${response.status}: ${body}`);
  if (response.status === 404) {
    console.error(
      "\nNo hay webhook registrado todavía. Antes de esto hace falta:\n" +
        "  1. npx ngrok http 3000        (y copiar la URL https que imprime)\n" +
        "  2. pegarla en webhooks.url de portal.config.ts\n" +
        "  3. npx portal deploy\n" +
        "  4. volver a lanzar este script",
    );
  }
  process.exit(1);
}

const secret = (JSON.parse(body).secret ?? JSON.parse(body).value ?? "").trim();
if (secret === "") {
  console.error(`Portal contestó 200 pero sin secreto reconocible: ${body.slice(0, 200)}`);
  process.exit(1);
}

const line = `PORTAL_WEBHOOK_SECRET=${secret}`;
const updated = /^PORTAL_WEBHOOK_SECRET=.*$/m.test(raw)
  ? raw.replace(/^PORTAL_WEBHOOK_SECRET=.*$/m, line)
  : `${raw.replace(/\s*$/, "")}\n${line}\n`;

writeFileSync(envPath, updated);
console.log("PORTAL_WEBHOOK_SECRET escrito en .env. Reinicia el dev server.");
