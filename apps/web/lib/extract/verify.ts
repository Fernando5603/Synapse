import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificación de la firma de un webhook de Portal.
 *
 * Cada entrega lleva `portal-signature: t=<unix seconds>,v1=<hex>`, donde `v1` es
 * `HMAC-SHA256(secret, "{t}.{rawBody}")` con el body crudo exacto que Portal mandó.
 * La guía manda verificar antes de procesar nada: rechazar con no-2xx y no tocar el body.
 */
export class WebhookVerificationError extends Error {}

const TOLERANCE_SECONDS = 5 * 60;

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): void {
  if (!signatureHeader) {
    throw new WebhookVerificationError("Falta la cabecera portal-signature.");
  }

  const parts = new Map<string, string>();
  for (const pair of signatureHeader.split(",")) {
    const [key, value] = pair.split("=");
    if (key && value) {
      parts.set(key, value);
    }
  }

  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !v1) {
    throw new WebhookVerificationError("Cabecera portal-signature malformada.");
  }

  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    throw new WebhookVerificationError("Timestamp de la firma fuera de tolerancia.");
  }

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const expectedBytes = Buffer.from(expected, "hex");
  const providedBytes = Buffer.from(v1, "hex");

  const matches =
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes);

  if (!matches) {
    throw new WebhookVerificationError("La firma no coincide.");
  }
}
