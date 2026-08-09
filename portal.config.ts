import { defineConfig } from "@portalsdk/config";

/**
 * Dónde escucha el webhook. **Esto no se toca.**
 *
 * Está separado del origen porque olvidarlo no da error: Portal postea a la raíz, Next
 * responde la home con `200 OK`, Portal lo da por entregado y no reintenta. El resultado
 * es una sala que chatea, con cursores, y un grafo que no crece nunca — sin una sola
 * línea roja en ningún sitio. Pasó, y costó una noche encontrarlo.
 */
const WEBHOOK_PATH = "/api/portal/webhook";

/**
 * El origen público que alcanza a esta app. **Esto es lo único que cambia.**
 *
 * En local es el túnel de ngrok hacia el 3000, y en el plan gratis **la URL cambia cada
 * vez que se reinicia ngrok**: hay que pegar la nueva aquí y volver a `npx portal deploy`.
 * En producción es la URL de Railway y entonces ngrok no hace falta para nada.
 *
 * Ojo: el entorno de Portal tiene **un solo** webhook. Desplegar la URL de Railway deja
 * al local sin recibir nada, y al revés. Es un cambio de destino, no una suma.
 */
const WEBHOOK_ORIGIN = "https://blah-guidance-gloomy.ngrok-free.dev";

export default defineConfig({
  webhooks: {
    url: `${WEBHOOK_ORIGIN}${WEBHOOK_PATH}`,
  },
  channels: {
    // Un template necesita prefijo fijo, así que el canal de una sala es `room-<slug>`
    // y no el slug pelado (ver `channelId` en `Room.tsx`). Así cualquier nombre de sala
    // que escriba el equipo queda cubierto sin tocar esta config.
    "room-*": {
      extensions: {
        graph: "./extensions/graph-owner.ts",
      },
      // Ticket 11: el aviso de contradicción viaja como mensaje dirigido con `to`; esta
      // regla lo convierte en item de inbox para su destinatario. No hay endpoint suelto
      // de notificaciones.
      notify: (ctx) => {
        if (ctx.message.type !== "contradiction.notice") {
          return null;
        }
        return {
          title: "Alguien contradice tu afirmación",
          data: { claimId: (ctx.message.content as { claimId?: string }).claimId ?? null },
          to: ctx.message.to ?? [],
        };
      },
    },
  },
});
