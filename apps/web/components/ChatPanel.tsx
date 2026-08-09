"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "@portalsdk/core";
import {
  resolveDisplayName,
  typingNames,
  type Me,
  type Participant,
} from "@/lib/display";

export type AgentBanner =
  | { kind: "thinking" }
  | { kind: "skipped" };

export default function ChatPanel({
  messages,
  me,
  participants,
  knownNames,
  onSend,
  action,
  agentBanner = null,
  typing = [],
  onTyping = () => {},
}: {
  messages: readonly Message<{ text: string }>[];
  me: Me | undefined;
  participants: Participant[];
  knownNames: ReadonlyMap<string, string>;
  onSend: (text: string) => void;
  action?: React.ReactNode;
  agentBanner?: AgentBanner | null;
  /** Ids de los usuarios que están escribiendo (del SDK de Portal). */
  typing?: readonly string[];
  /** Señal de "estoy escribiendo" (sendTyping del SDK); throttled por el llamador. */
  onTyping?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Deja de seguir el final si el usuario se fue a leer hacia arriba.
  const stickToBottom = useRef(true);
  // El SDK throttlea `sendTyping`; este ref evita dispararlo en cada tecla.
  const lastTypingRef = useRef(0);

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
        {agentBanner !== null && (
          <div
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              marginBottom: 12,
              fontSize: 13,
              ...bannerStyle(agentBanner),
            }}
          >
            {bannerText(agentBanner)}
          </div>
        )}
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
      {action !== undefined && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "8px 16px",
            borderBottom: "1px solid #ddd",
          }}
        >
          {action}
        </div>
      )}
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <TypingBanner typing={typing} me={me} participants={participants} />
          <input
            style={{ padding: "8px 12px", width: "100%" }}
            placeholder="Escribe un mensaje…"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              const now = Date.now();
              if (e.target.value !== "" && now - lastTypingRef.current > 1000) {
                lastTypingRef.current = now;
                onTyping();
              }
            }}
          />
        </div>
        <button type="submit" style={{ padding: "8px 16px" }}>
          Enviar
        </button>
      </form>
    </section>
  );
}

function bannerStyle(banner: AgentBanner): React.CSSProperties {
  switch (banner.kind) {
    case "thinking":
      return { background: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe" };
    case "skipped":
      return { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" };
  }
}

function bannerText(banner: AgentBanner): string {
  switch (banner.kind) {
    case "thinking":
      return "El agente está pensando…";
    case "skipped":
      return "El agente se saltó un turno.";
  }
}

function TypingBanner({
  typing,
  me,
  participants,
}: {
  typing: readonly string[];
  me: Me | undefined;
  participants: Participant[];
}) {
  const names = typingNames(typing, me, participants);
  if (names.length === 0) {
    return <div style={{ minHeight: 18, fontSize: 12, color: "#888" }} />;
  }
  const text =
    names.length === 1
      ? `${names[0]} está escribiendo…`
      : `${names.join(", ")} están escribiendo…`;
  return (
    <div style={{ minHeight: 18, fontSize: 12, color: "#888", fontStyle: "italic" }}>
      {text}
    </div>
  );
}
