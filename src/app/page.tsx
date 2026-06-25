"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessageSquare, Plus, Paperclip, Globe, Mic, ArrowUp,
  PanelLeft, Clock, ChevronUp, Loader2, ShieldCheck, Sparkles, Trash2,
} from "lucide-react";
import { ModelSelect } from "@/components/ModelSelect";
import { useMirrl, type ChatMsg } from "@/lib/store";
import type { OgModel } from "@/lib/og";

type Msg = ChatMsg;

export default function HomePage() {
  const {
    signedIn, memories, addMemory, model, setModel, network,
    sessions, activeId, newChat, openChat, saveChat, deleteChat,
  } = useMirrl();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"ask" | "remember">("ask");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);

  // Restore the last active conversation once sessions hydrate from storage.
  useEffect(() => {
    if (restored.current) return;
    if (activeId) {
      const s = sessions.find((x) => x.id === activeId);
      if (s) {
        setMessages(s.messages);
        restored.current = true;
      }
    }
  }, [activeId, sessions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");

    if (mode === "remember") {
      addMemory(text);
      const next: Msg[] = [
        ...messages,
        { role: "user", content: text },
        { role: "assistant", content: "Saved. I'll remember that — it's yours, persisted to 0G Storage.", meta: "memory · 0G Storage" },
      ];
      setMessages(next);
      saveChat(next);
      return;
    }

    const history: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          model,
          memory: memories.map((m) => m.text),
          network,
        }),
      });
      const data = await res.json();
      const next: Msg[] = [...history, { role: "assistant", content: data.reply, meta: `${data.mode === "live" ? "0G Compute" : "demo"} · ${data.model}` }];
      setMessages(next);
      saveChat(next);
    } catch {
      const next: Msg[] = [...history, { role: "assistant", content: "Something went wrong reaching 0G Compute.", meta: "error" }];
      setMessages(next);
      saveChat(next);
    } finally {
      setSending(false);
    }
  }

  function startNewChat() {
    newChat();
    setMessages([]);
    restored.current = true;
  }

  function selectChat(id: string) {
    const s = openChat(id);
    setMessages(s?.messages ?? []);
    restored.current = true;
  }

  const empty = messages.length === 0;

  return (
    <main className="flex flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4">
        {empty ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center pb-24 text-center">
            <h1 className="text-5xl font-bold tracking-tight">Hello, {signedIn ? "you" : "anon"}.</h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              {signedIn
                ? "Your memory is open. Everything you tell me is stored on 0G — private, and yours forever."
                : "Sign in to open your memory. Until then we don't know you, and nothing is stored."}
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-5 py-8 pb-28">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={m.role === "user" ? "max-w-[80%]" : "max-w-[85%]"}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                      m.role === "user" ? "bg-foreground text-background" : "bg-surface border border-border text-foreground"
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.meta && (
                    <div className={`mt-1 flex items-center gap-1 text-[10px] text-muted-2 ${m.role === "user" ? "justify-end" : ""}`}>
                      <ShieldCheck size={10} className="text-emerald-400/70" /> {m.meta}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted">
                  <Loader2 size={14} className="animate-spin" /> thinking on 0G…
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="px-4 pb-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-border-strong bg-surface px-3 pt-3 pb-2 shadow-xl shadow-black/30">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={mode === "remember" ? "Tell Mirrl something to remember…" : "Ask Mirrl anything…"}
              className="max-h-40 w-full resize-none bg-transparent px-2 pt-1 text-[15px] text-foreground placeholder:text-muted-2 outline-none"
            />
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1">
                <button className="rounded-md p-1.5 text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
                  <Paperclip size={16} />
                </button>
                <div className="flex rounded-lg bg-surface-2 p-0.5">
                  <button
                    onClick={() => setMode("ask")}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      mode === "ask" ? "bg-background text-foreground shadow" : "text-muted hover:text-foreground"
                    }`}
                  >
                    <MessageSquare size={13} /> Ask
                  </button>
                  <button
                    onClick={() => setMode("remember")}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      mode === "remember" ? "bg-background text-foreground shadow" : "text-muted hover:text-foreground"
                    }`}
                  >
                    <Sparkles size={13} /> Remember
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <ModelSelect value={model} onChange={(m: OgModel) => setModel(m.model)} />
                <button className="rounded-md p-1.5 text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
                  <Globe size={15} />
                </button>
                <button className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
                  <Mic size={15} /> Speak
                </button>
                <button
                  onClick={send}
                  disabled={!input.trim() || sending}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background transition disabled:opacity-30"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
                </button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-2">
            {network === "testnet" ? "0G Galileo Testnet" : "0G Mainnet"} · inference is TEE-verifiable · memory: {memories.length} stored on 0G
          </p>
        </div>
      </div>

      {/* floating chat sidebar */}
      <div className="pointer-events-none absolute bottom-6 left-4 z-30">
        <div className="pointer-events-auto w-60 rounded-2xl border border-border bg-surface/80 p-2 backdrop-blur">
          <div className="flex items-center justify-between px-1 pb-1">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="rounded-md p-1.5 text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              <PanelLeft size={16} />
            </button>
          </div>
          <button
            onClick={startNewChat}
            className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-surface-2 transition-colors"
          >
            <Plus size={15} /> New chat
          </button>
          {sidebarOpen && (
            <>
              <div className="px-2 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-2">Recents</div>
              {sessions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-2">No conversations yet.</div>
              ) : (
                sessions.slice(0, 4).map((s) => (
                  <div
                    key={s.id}
                    onClick={() => selectChat(s.id)}
                    className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      s.id === activeId ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.id === activeId ? "bg-foreground" : "bg-muted-2"}`} />
                    <span className="flex-1 truncate">{s.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (s.id === activeId) setMessages([]);
                        deleteChat(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-2 hover:text-foreground transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
              <button
                onClick={() => setHistoryOpen((o) => !o)}
                className="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Clock size={14} /> Chat History
                  {sessions.length > 0 && <span className="text-muted-2">{sessions.length}</span>}
                </span>
                <ChevronUp size={14} className={`transition-transform ${historyOpen ? "" : "rotate-180"}`} />
              </button>
              {historyOpen && (
                <div className="mt-1 max-h-48 overflow-y-auto border-t border-border pt-1">
                  {sessions.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-2">Nothing here yet.</div>
                  ) : (
                    sessions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => selectChat(s.id)}
                        className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                          s.id === activeId ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
                        }`}
                      >
                        <span className="flex-1 truncate">{s.title}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (s.id === activeId) setMessages([]);
                            deleteChat(s.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-muted-2 hover:text-foreground transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
