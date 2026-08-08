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
    if (!apiKey) {
      throw new Error("NEXT_PUBLIC_PORTAL_API_KEY is not set");
    }
    return new Portal({ apiKey });
  }, []);

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
