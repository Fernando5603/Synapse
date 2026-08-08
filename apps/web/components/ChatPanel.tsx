"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "@portalsdk/core";
import {
  resolveDisplayName,
  type Me,
  type Participant,
} from "@/lib/display";

export default function ChatPanel({
  messages,
  me,
  participants,
  knownNames,
  onSend,
}: {
  messages: readonly Message<{ text: string }>[];
  me: Me | undefined;
  participants: Participant[];
  knownNames: ReadonlyMap<string, string>;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Deja de seguir el final si el usuario se fue a leer hacia arriba.
  const stickToBottom = useRef(true);

  useEffect(() => {
    const element = scrollRef.current;
    if (element === null || !stickToBottom.current) {
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [messages.length]);

  function handleScroll() {
    const element = scrollRef.current;
    if (element === null) {
      return;
    }
    const distanceToBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    stickToBottom.current = distanceToBottom < 40;
  }

  return (
    <section
      style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}
    >
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: "auto", padding: 16 }}
      >
        {messages.length === 0 ? (
          <p style={{ color: "#666" }}>Todavía no hay mensajes.</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              style={{ marginBottom: 12, fontSize: 14 }}
            >
              <strong>
                {resolveDisplayName(message.sender, me, participants, knownNames)}
              </strong>
              <span style={{ color: "#999", marginLeft: 8 }}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
              <p style={{ margin: "2px 0 0" }}>{message.content.text}</p>
            </div>
          ))
        )}
      </div>
      <form
        style={{ display: "flex", gap: 8, padding: 16, borderTop: "1px solid #ddd" }}
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = draft.trim();
          if (trimmed === "") {
            return;
          }
          onSend(trimmed);
          setDraft("");
        }}
      >
        <input
          style={{ flex: 1, padding: "8px 12px" }}
          placeholder="Escribe un mensaje…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" style={{ padding: "8px 16px" }}>
          Enviar
        </button>
      </form>
    </section>
  );
}
