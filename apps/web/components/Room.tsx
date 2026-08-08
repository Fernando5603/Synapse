"use client";

import { useChannel } from "@portalsdk/react";
import { useEffect, useState } from "react";
import ChatPanel from "./ChatPanel";
import PresenceBar from "./PresenceBar";
import { detailedParticipants, resolveDisplayName } from "@/lib/display";

export default function Room({
  roomId,
  displayName,
}: {
  roomId: string;
  displayName: string;
}) {
  const { messages, send, presence, me, status } = useChannel<{ text: string }>(
    { channelId: roomId, metadata: { displayName } },
  );

  const participants = detailedParticipants(presence);

  const [knownNames, setKnownNames] = useState<Map<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    if (me === undefined) {
      return;
    }
    setKnownNames((previous) => {
      const next = new Map(previous);
      for (const participant of participants) {
        if (!next.has(participant.id)) {
          next.set(
            participant.id,
            resolveDisplayName(participant, me, participants),
          );
        }
      }
      return next;
    });
  }, [participants, me]);

  return (
    <main style={{ display: "flex", height: "100vh" }}>
      <PresenceBar me={me} participants={participants} status={status} />
      <ChatPanel
        messages={messages}
        me={me}
        participants={participants}
        knownNames={knownNames}
        onSend={(text) => send({ content: { text } })}
      />
    </main>
  );
}
