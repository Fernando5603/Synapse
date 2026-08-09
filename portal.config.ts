import { defineConfig } from "@portalsdk/config";

export default defineConfig({
  channels: {
    // Un template necesita prefijo fijo, así que el canal de una sala es `room-<slug>`
    // y no el slug pelado (ver `channelId` en `Room.tsx`). Así cualquier nombre de sala
    // que escriba el equipo queda cubierto sin tocar esta config.
    "room-*": {
      extensions: {
        graph: "./extensions/graph-owner.ts",
      },
    },
  },
});
