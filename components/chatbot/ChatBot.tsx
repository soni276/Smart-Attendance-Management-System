"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Minus, Send, Trash2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { buildClientStoreSnapshot } from "@/lib/client-store";
import {
  getChatHistory,
  saveChatHistory,
} from "@/lib/storage";
import { cn, generateId } from "@/lib/utils";
import { toastError } from "@/lib/toast-helpers";
import type { ChatMessage } from "@/types";

const QUICK_ACTIONS = [
  "Who's absent today?",
  "Show defaulters",
  "CS301 stats",
  "Today's summary",
];

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [&_a]:text-indigo-300 [&_a]:underline [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_h1]:font-display [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-white [&_h2]:font-display [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-white [&_h3]:font-display [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-white [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:text-sm [&_p]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-white [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-md [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1 [&_td]:text-[12px] [&_th]:border [&_th]:border-white/10 [&_th]:bg-white/10 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:text-white">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages(getChatHistory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveChatHistory(messages);
  }, [messages, hydrated]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isStreaming]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming || trimmed.length > 500) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      const assistantId = generateId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };

      const history = [...messages, userMsg];
      setMessages([...history, assistantMsg]);
      setInputText("");
      setIsStreaming(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            conversationHistory: history,
            _store: buildClientStoreSnapshot(),
          }),
        });

        if (!res.ok) {
          let errMsg = `Chat failed (${res.status})`;
          try {
            const err = (await res.json()) as { error?: string };
            if (err.error) errMsg = err.error;
          } catch {
            // response wasn't JSON
          }
          throw new Error(errMsg);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No stream available");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: accumulated } : m
            )
          );
        }

        if (!accumulated.trim()) {
          throw new Error(
            "Empty response from AI. Please check your OpenAI API key in Settings."
          );
        }

        if (!open) setHasUnread(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to send";
        toastError(msg);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, messages, open]
  );

  const handleOpen = () => {
    setOpen(true);
    setMinimized(false);
    setHasUnread(false);
  };

  return (
    <>
      <AnimatePresence>
        {open && !minimized && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className={cn(
              "fixed z-50 flex flex-col overflow-hidden border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-2xl",
              "bottom-24 right-6 rounded-2xl",
              "h-[560px] w-[380px] max-md:inset-0 max-md:bottom-0 max-md:right-0 max-md:h-full max-md:w-full max-md:rounded-none"
            )}
          >
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-display font-semibold text-white">CampusBot</p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        isStreaming ? "bg-yellow-400" : "bg-green-400"
                      )}
                    />
                    {isStreaming ? "Thinking..." : "Online"}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMessages([]);
                      saveChatHistory([]);
                    }}
                    className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                    aria-label="Clear conversation"
                    title="Clear conversation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMinimized(true)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                  aria-label="Minimize"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {messages.length === 0 && !isStreaming && (
              <div className="border-b border-white/5 px-3 py-2">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {QUICK_ACTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="shrink-0 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-200 hover:bg-indigo-500/20"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{
                      opacity: 0,
                      x: msg.role === "user" ? 20 : -20,
                    }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "flex gap-2",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/30">
                        <Bot className="h-4 w-4 text-indigo-300" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2",
                        msg.role === "user"
                          ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white"
                          : "border border-white/10 bg-white/[0.04] text-slate-200"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        msg.content ? (
                          <div className="relative">
                            <MarkdownContent text={msg.content} />
                            {isStreaming &&
                              msg.id ===
                                messages[messages.length - 1]?.id && (
                                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-indigo-400" />
                              )}
                          </div>
                        ) : null
                      ) : (
                        <p className="whitespace-pre-wrap text-sm">
                          {msg.content}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] opacity-60">
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isStreaming &&
                messages[messages.length - 1]?.role === "assistant" &&
                !messages[messages.length - 1]?.content && (
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/30">
                      <Bot className="h-4 w-4 text-indigo-300" />
                    </div>
                    <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-2 w-2 rounded-full bg-indigo-400"
                          animate={{ y: [0, -6, 0] }}
                          transition={{
                            repeat: Infinity,
                            duration: 0.6,
                            delay: i * 0.15,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
            </div>

            <div className="border-t border-white/10 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value.slice(0, 500));
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(inputText);
                    }
                  }}
                  disabled={isStreaming}
                  placeholder="Ask about attendance…"
                  rows={1}
                  className="max-h-24 flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => sendMessage(inputText)}
                  disabled={isStreaming || !inputText.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-right text-[10px] text-slate-600">
                {inputText.length}/500
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => (open && !minimized ? setOpen(false) : handleOpen())}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30"
        aria-label="Open CampusBot"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-indigo-500/30" />
        <span className="absolute inset-0 rounded-full ring-2 ring-indigo-400/50 ring-offset-2 ring-offset-[#0a0a0f] animate-[pulse-ring_2s_ease-out_infinite]" />
        <Bot className="relative h-6 w-6" />
        {hasUnread && (
          <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-[#0a0a0f] bg-red-500" />
        )}
      </motion.button>
    </>
  );
}
