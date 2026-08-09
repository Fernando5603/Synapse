import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Carga el `.env` de la raíz del monorepo.
 *
 * Next lee los `.env` de **su propio** directorio (`apps/web`), no del workspace. Con las
 * claves solo en la raíz, `process.env.NEXT_GROQ_API_KEY` y `PORTAL_WEBHOOK_SECRET`
 * llegaban vacías al servidor: el extractor se construía en su versión que siempre falla
 * y el webhook rechazaba cada POST, así que no se extraía ni un nodo — sin un solo error
 * a la vista, porque las dos rutas están escritas para no romper la sala.
 *
 * Lo de `apps/web` sigue ganando: esto solo rellena lo que falte, así que un `.env.local`
 * de la app puede seguir sobrescribiendo cualquier clave.
 */
const here = dirname(fileURLToPath(import.meta.url));
for (const name of [".env", ".env.local"]) {
  const file = resolve(here, "../..", name);
  if (!existsSync(file)) {
    continue;
  }
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
