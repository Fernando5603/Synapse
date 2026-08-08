"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");

  return (
    <main
      style={{ maxWidth: 420, margin: "10vh auto 0", padding: "0 16px", textAlign: "center" }}
    >
      <h1>Synapse</h1>
      <p>Entra a una sala compartida.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const slug = roomId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
          if (slug !== "") {
            router.push(`/room/${slug}`);
          }
        }}
      >
        <input
          autoFocus
          placeholder="Nombre de la sala"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          style={{ padding: "8px 12px", width: "100%", marginBottom: 8 }}
        />
        <button type="submit" style={{ padding: "8px 16px" }}>
          Entrar
        </button>
      </form>
    </main>
  );
}
