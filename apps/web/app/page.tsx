"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <main
      style={{ maxWidth: 420, margin: "10vh auto 0", padding: "0 16px", textAlign: "center" }}
    >
      <h1>Synapse</h1>
      <p>Escribe el nombre de la sala (p. ej. "inteligencia") y entra.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const slug = roomId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
          if (slug === "") {
            setError("Escribe un nombre de sala.");
            return;
          }
          router.push(`/room/${slug}`);
        }}
      >
        <input
          autoFocus
          placeholder="Nombre de la sala"
          value={roomId}
          onChange={(e) => {
            setRoomId(e.target.value);
            setError(null);
          }}
          style={{ padding: "8px 12px", width: "100%", marginBottom: 8 }}
        />
        {error !== null && (
          <p style={{ color: "#991b1b", fontSize: 13, margin: "0 0 8px" }}>{error}</p>
        )}
        <button type="submit" style={{ padding: "8px 16px" }}>
          Entrar a la sala
        </button>
      </form>
    </main>
  );
}
