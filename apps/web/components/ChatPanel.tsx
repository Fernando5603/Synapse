"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "@portalsdk/core";
import { AlertTriangle, MessagesSquare, Send, Sparkles } from "lucide-react";
import {
  resolveDisplayName,
  typingNames,
  type Me,
  type Participant,
} from "@/lib/display";
import { participantColor } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export type AgentBanner = { kind: "thinking" } | { kind: "skipped" };

export default function ChatPanel({
  messages,
  me,
  participants,
  knownNames,
  onSend,
  header,
  agentBanner = null,
  typing = [],
  onTyping = () => {},
}: {
  messages: readonly Message<{ text: string }>[];
  me: Me | undefined;
  participants: Participant[];
  knownNames: ReadonlyMap<string, string>;
  onSend: (text: string) => void;
  /** Los botones de sesión, que viven en la cabecera del chat. */
  header?: React.ReactNode;
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
    <section className="flex h-full min-w-0 flex-col glass">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessagesSquare className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Conversación
        </h2>
        <div className="ml-auto flex items-center gap-1.5">{header}</div>
      </header>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-3">
        {agentBanner !== null && <AgentBannerRow banner={agentBanner} />}
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Todavía no hay mensajes.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((message) => {
              const name = resolveDisplayName(message.sender, me, participants, knownNames);
              const mine = me !== undefined && message.sender.id === me.id;
              return (
                <li key={message.id} className="animate-fade-in">
                  <div className="mb-0.5 flex items-baseline gap-2">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: participantColor(message.sender.id) }}
                    >
                      {name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "rounded-lg rounded-tl-sm border px-3 py-2 text-sm leading-relaxed",
                      mine
                        ? "border-primary/30 bg-primary/10"
                        : "border-border bg-secondary/40",
                    )}
                  >
                    {message.content.text}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form
        className="border-t border-border p-3"
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
        <TypingBanner typing={typing} me={me} participants={participants} />
        <div className="flex gap-2">
          <Input
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
          <Button size="icon" type="submit" className="h-9 w-9 shrink-0" title="Enviar">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </section>
  );
}

function AgentBannerRow({ banner }: { banner: AgentBanner }) {
  const thinking = banner.kind === "thinking";
  return (
    <div
      className={cn(
        "mb-3 flex animate-fade-in items-center gap-2 rounded-lg border px-3 py-2 text-xs",
        thinking
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {thinking ? (
        <Sparkles className="h-3.5 w-3.5 shrink-0 animate-pulse" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      )}
      {thinking ? "Synapse está leyendo la conversación…" : "Synapse se saltó un turno."}
    </div>
  );
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
    return <div className="h-4" />;
  }
  const text =
    names.length === 1
      ? `${names[0]} está escribiendo…`
      : `${names.join(", ")} están escribiendo…`;
  return (
    <div className="flex h-4 items-center gap-1.5 text-[11px] italic text-muted-foreground">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </span>
      {text}
    </div>
  );
}
