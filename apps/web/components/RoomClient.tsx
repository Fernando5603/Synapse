"use client";

import { Portal } from "@portalsdk/core";
import { PortalProvider } from "@portalsdk/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Room from "./Room";
import { JoinForm } from "./JoinForm";

const DISPLAY_NAME_KEY = "synapse:displayName";

// localStorage puede estar bloqueado (incógnito con cookies de terceros, iframe, o la
// app servida por un túnel): getItem/setItem lanzan SecurityError. Si no hay storage,
// el nombre vive en memoria — basta para la sesión y evita el bucle de "vuelve a pedir".
const memoryStore = new Map<string, string>();

function readStoredName(): string | null {
  const value = memoryStore.get(DISPLAY_NAME_KEY);
  if (value !== undefined) {
    return value;
  }
  try {
    return window.localStorage.getItem(DISPLAY_NAME_KEY);
  } catch {
    return null;
  }
}

function storeName(name: string): void {
  memoryStore.set(DISPLAY_NAME_KEY, name);
  try {
    window.localStorage.setItem(DISPLAY_NAME_KEY, name);
  } catch {
    // Sin storage persistente: el nombre queda en memoria para esta sesión.
  }
}

/**
 * Olvida el nombre por los dos caminos por los que se guardó.
 *
 * Los dos: limpiar solo `localStorage` dejaría el de memoria en pie y el formulario de
 * entrada no volvería a salir — que es exactamente el síntoma de "no se puede salir".
 */
function forgetName(): void {
  memoryStore.delete(DISPLAY_NAME_KEY);
  try {
    window.localStorage.removeItem(DISPLAY_NAME_KEY);
  } catch {
    // Sin storage: con borrar el de memoria basta.
  }
}

export default function RoomClient({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(readStoredName());
  }, []);

  const portal = useMemo(() => {
    const apiKey = process.env.NEXT_PUBLIC_PORTAL_API_KEY;
    return apiKey ? new Portal({ apiKey }) : null;
  }, []);

  // Lanzar aquí dejaría la pantalla en blanco en un deploy sin la variable: el throw
  // ocurre en render, antes incluso del formulario de entrada.
  if (portal === null) {
    return (
      <main className="mx-auto mt-[10vh] max-w-lg px-4">
        <h1 className="mb-3 text-2xl font-semibold">Synapse</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Falta <code className="font-mono text-foreground">NEXT_PUBLIC_PORTAL_API_KEY</code>.
          Copia <code className="font-mono text-foreground">.env.example</code> a{" "}
          <code className="font-mono text-foreground">.env.local</code> con la publishable
          key de Portal (<code className="font-mono text-foreground">pk_…</code>), o defínela
          en el entorno del deploy.
        </p>
      </main>
    );
  }

  if (displayName === null) {
    return <JoinForm roomId={roomId} onJoin={handleJoin} onCancel={() => router.push("/")} />;
  }

  return (
    <PortalProvider client={portal}>
      <Room roomId={roomId} displayName={displayName} onLeave={handleLeave} />
    </PortalProvider>
  );

  function handleJoin(name: string) {
    storeName(name);
    setDisplayName(name);
  }

  /**
   * Salir de la sala. Desmontar `Room` desmonta el `useChannel`, que suelta el handle:
   * el socket se cierra y la presencia deja de anunciar a esta persona. Volver al home
   * después es lo que evita que el efecto de arranque lea el nombre otra vez y reentre.
   */
  function handleLeave() {
    forgetName();
    setDisplayName(null);
    router.push("/");
  }
}
