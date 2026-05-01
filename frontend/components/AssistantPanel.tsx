"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai";
import { clsx } from "clsx";
import { useCallback, useMemo, useState } from "react";

type Props = {
  token: string;
  onActionsDone?: () => void | Promise<void>;
};

function messageTextParts(m: UIMessage) {
  return m.parts.filter(isTextUIPart);
}

export function AssistantPanel({ token, onActionsDone }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/chat",
        headers: () => ({ Authorization: `Bearer ${token}` }),
      }),
    [token],
  );

  const { messages, sendMessage, status, stop, error } = useChat<UIMessage>({
    transport,
    onFinish: () => {
      void onActionsDone?.();
    },
  });

  const busy = status === "streaming" || status === "submitted";

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const t = input.trim();
      if (!t || busy) return;
      setInput("");
      await sendMessage({ text: t });
    },
    [input, busy, sendMessage],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition",
          open
            ? "bg-zinc-700 text-white ring-2 ring-sky-500/40"
            : "bg-sky-600 text-white hover:bg-sky-500",
        )}
        aria-expanded={open}
        aria-label={open ? "Cerrar asistente" : "Abrir asistente IA"}
        title="Asistente IA"
      >
        {open ? (
          <span className="text-lg leading-none">×</span>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.455 2.456Z"
            />
          </svg>
        )}
      </button>

      {open ? (
        <div
          className="fixed bottom-24 right-6 z-50 flex h-[min(70vh,560px)] w-[min(100vw-1.5rem,400px)] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
          role="dialog"
          aria-label="Asistente IA"
        >
          <div className="border-b border-zinc-800 px-3 py-2">
            <p className="text-sm font-medium text-white">Asistente</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-2">
            {messages.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Ej.: «Asigna el ticket sobre facturación a Ana» o «Elimina el ticket con título X» (confirma el id antes).
              </p>
            ) : null}
            {messages.map((m, idx) => {
              const texts = messageTextParts(m);
              const isLast = idx === messages.length - 1;
              const placeholderAssistant =
                m.role === "assistant" &&
                texts.length === 0 &&
                busy &&
                isLast;

              if (m.role === "assistant" && texts.length === 0 && !placeholderAssistant) {
                return null;
              }

              return (
                <div
                  key={m.id}
                  className={clsx(
                    "rounded-lg px-2 py-2 text-sm",
                    m.role === "user" ? "ml-4 bg-zinc-800 text-zinc-100" : "mr-4 text-zinc-200",
                  )}
                >
                  {m.role === "user"
                    ? texts.map((part, i) => (
                        <p key={i} className="whitespace-pre-wrap">
                          {part.text}
                        </p>
                      ))
                    : null}
                  {m.role === "assistant"
                    ? placeholderAssistant
                      ? (
                          <p className="animate-pulse text-zinc-500">Un momento…</p>
                        )
                      : texts.map((part, i) => (
                          <p key={i} className="whitespace-pre-wrap">
                            {part.text}
                          </p>
                        ))
                    : null}
                </div>
              );
            })}
          </div>

          {error ? (
            <div className="border-t border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">{error.message}</div>
          ) : null}

          <form onSubmit={onSubmit} className="border-t border-zinc-800 p-2">
            <div className="flex gap-2">
              <textarea
                className="min-h-[44px] flex-1 resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                placeholder="Escribe tu petición…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={2}
                disabled={busy}
              />
              <div className="flex flex-col gap-1">
                {busy ? (
                  <button
                    type="button"
                    onClick={() => void stop()}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    Parar
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
                >
                  Enviar
                </button>
              </div>
            </div>
          </form>
          <p className="border-t border-zinc-900 px-3 py-1.5 text-[10px] text-zinc-600">
            Basado en{" "}
            <a href="https://ai-sdk.dev" className="text-sky-500 hover:underline" target="_blank" rel="noreferrer">
              AI SDK
            </a>
            . UI propia.
          </p>
        </div>
      ) : null}
    </>
  );
}
