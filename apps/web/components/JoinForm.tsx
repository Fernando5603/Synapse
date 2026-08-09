"use client";

import { useState } from "react";

export function JoinForm({ onJoin }: { onJoin: (name: string) => void }) {
  const [name, setName] = useState("");

  return (
    <main
      style={{
        maxWidth: 420,
        margin: "10vh auto 0",
        padding: "0 16px",
        textAlign: "center",
      }}
    >
      <h1>Synapse</h1>
      <p>¿Cómo te llamas? Así te ven los demás en la sala.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (trimmed !== "") {
            onJoin(trimmed);
          }
        }}
      >
        <input
          autoFocus
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: "8px 12px", width: "100%", marginBottom: 8 }}
        />
        <button type="submit" style={{ padding: "8px 16px" }}>
          Entrar a la sala
        </button>
      </form>
    </main>
  );
}
