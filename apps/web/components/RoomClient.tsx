"use client";

import { Portal } from "@portalsdk/core";
import { PortalProvider } from "@portalsdk/react";
import { useEffect, useMemo, useState } from "react";
import Room from "./Room";
import { JoinForm } from "./JoinForm";

const DISPLAY_NAME_KEY = "synapse:displayName";

export default function RoomClient({ roomId }: { roomId: string }) {
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(window.localStorage.getItem(DISPLAY_NAME_KEY));
  }, []);

  const portal = useMemo(() => {
    const apiKey = process.env.NEXT_PUBLIC_PORTAL_API_KEY;
    return apiKey ? new Portal({ apiKey }) : null;
  }, []);

  // Lanzar aquí dejaría la pantalla en blanco en un deploy sin la variable: el throw
  // ocurre en render, antes incluso del formulario de entrada.
  if (portal === null) {
    return (
      <main style={{ maxWidth: 520, margin: "10vh auto 0", padding: "0 16px" }}>
        <h1>Synapse</h1>
        <p>
          Falta <code>NEXT_PUBLIC_PORTAL_API_KEY</code>. Copia{" "}
          <code>.env.example</code> a <code>.env.local</code> con la publishable
          key de Portal (<code>pk_…</code>), o defínela en el entorno del deploy.
        </p>
      </main>
    );
  }

  if (displayName === null) {
    return <JoinForm onJoin={handleJoin} />;
  }

  return (
    <PortalProvider client={portal}>
      <Room roomId={roomId} displayName={displayName} />
    </PortalProvider>
  );

  function handleJoin(name: string) {
    window.localStorage.setItem(DISPLAY_NAME_KEY, name);
    setDisplayName(name);
  }
}
