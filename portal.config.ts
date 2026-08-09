import { defineConfig } from "@portalsdk/config";

export default defineConfig({
  // Portal entrega un POST firmado por cada mensaje persistido. El handler del webhook
  // vive en `apps/web/app/api/portal/webhook`. Esta URL es de un túnel ngrok hacia
  // localhost:3000; cambia cada vez que se reinicia ngrok (plan gratis) — actualizarla y
  // `portal deploy` de nuevo. Para producción usar la URL de Railway.
  webhooks: {
    url: "https://731c-2800-200-f5b0-f9-5815-1c5f-d120-e21d.ngrok-free.app/api/portal/webhook",
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
