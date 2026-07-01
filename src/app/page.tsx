"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus, Paperclip, Globe, Mic, ArrowUp,
  PanelLeft, Clock, ChevronUp, Loader2, ShieldCheck, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ModelSelect } from "@/components/ModelSelect";
import { Markdown } from "@/components/Markdown";
import { useMirrl, type ChatMsg } from "@/lib/store";
import type { OgModel } from "@/lib/og";

type Msg = ChatMsg;

// Don't remember questions, commands or greetings — only things the user states.
function isQuestion(t: string): boolean {
  const s = t.trim().toLowerCase();
  if (s.endsWith("?")) return true;
  return /^(what|how|why|when|where|who|which|whose|can|could|would|should|is|are|am|was|were|do|does|did|will|tell me|explain|show|give|list|find|search|help|rank|compare|best|top|hi|hey|hello|thanks|thank|ok|okay|yes|no|sure)\b/.test(s);
}

// Only remember statements *about the user* — must reference themselves.
function isPersonalFact(t: string): boolean {
  return /\b(i|i'm|im|i've|ive|i'll|i'd|my|me|mine|myself|we|our|us)\b/i.test(t);
}

export default function HomePage() {
  const {
    signedIn, memories, addMemory, model, setModel, network, requireAuth, openSignIn, commitMemory,
    sessions, activeId, newChat, openChat, saveChat, deleteChat,
  } = useMirrl();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  // Sign out → clear the open chat and return to the anon page.
  useEffect(() => {
    if (!signedIn) {
      setMessages([]);
      restored.current = false;
    }
  }, [signedIn]);

  // Warm the inference broker as soon as a signed-in user lands, so their first
  // message doesn't pay the cold broker/ledger/service setup cost.
  useEffect(() => {
    if (signedIn) fetch(`/api/chat?net=${network}`).catch(() => {});
  }, [signedIn, network]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // Seal memory to 0G when the tab closes (a session ending without "New chat").
  useEffect(() => {
    const onUnload = () => {
      if (!signedIn) return;
      try {
        const blob = new Blob([JSON.stringify({ network })], { type: "application/json" });
        navigator.sendBeacon("/api/memory/commit", blob);
      } catch {}
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [signedIn, network]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    if (!requireAuth()) return; // signed-out → prompt sign-in instead of a hollow demo
    setInput("");

    // Every message quietly teaches Mirrl — extract durable facts and remember
    // them so the next question can recall them. No "Remember" toggle needed.
    autoRemember(text);

    const history: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "", meta: "…" }]);
    setSending(true);

    let acc = "";
    let meta = "…";
    const paint = () =>
      setMessages([...history, { role: "assistant", content: acc, meta }]);

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
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: { type: string; text?: string; mode?: string; model?: string; note?: string };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === "meta") {
            const base = `${ev.mode === "live" ? "0G Compute" : "demo"} · ${ev.model}`;
            meta = ev.mode !== "live" && ev.note ? `${base} — ${ev.note}` : base;
            paint();
            // server fell back to a funded model → reflect it in the picker + notify
            if (ev.mode === "live" && ev.model && ev.model !== model) {
              setModel(ev.model);
              toast(`Switched to ${ev.model}`, {
                description: "Your selected model isn't funded yet — using one you've enabled.",
              });
            }
          } else if (ev.type === "delta" && ev.text) {
            acc += ev.text;
            paint();
          }
        }
      }
      if (!acc) acc = "(no response)";
      const final: Msg[] = [...history, { role: "assistant", content: acc, meta }];
      setMessages(final);
      saveChat(final);
    } catch {
      const final: Msg[] = [...history, { role: "assistant", content: "Something went wrong reaching 0G Compute.", meta: "error" }];
      setMessages(final);
      saveChat(final);
    } finally {
      setSending(false);
    }
  }

  // Distill durable facts from a message and remember them (fire-and-forget).
  // Questions/commands/greetings are skipped — we only remember things you state.
  async function autoRemember(text: string) {
    // only learn from genuine personal statements, never questions/queries
    if (isQuestion(text) || !isPersonalFact(text) || text.split(/\s+/).length < 4) return;
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const facts: string[] = (await res.json())?.facts ?? [];
      const known = new Set(memories.map((m) => m.text.toLowerCase()));
      facts
        .filter((f) => !isQuestion(f) && isPersonalFact(f) && !known.has(f.toLowerCase()))
        .forEach((f) => addMemory(f, "chat"));
    } catch {}
  }

  function startNewChat() {
    commitMemory(); // session ended → seal its memory to 0G, then clear the cache
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
    <main className="flex min-w-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto px-4">
        {empty ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center pb-24 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Hello, {signedIn ? "you" : "anon"}.</h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              {signedIn
                ? "Your memory is open. Everything you tell me is stored on 0G — private, and yours forever."
                : "Sign in to open your memory. Until then we don't know you, and nothing is stored."}
            </p>
            {!signedIn && (
              <button
                onClick={openSignIn}
                className="mt-6 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
              >
                Sign in to start
              </button>
            )}
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-5 py-8 pb-28">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`min-w-0 ${m.role === "user" ? "max-w-[80%]" : "max-w-[85%]"}`}>
                  <div
                    className={`overflow-hidden rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed break-words ${
                      m.role === "user" ? "bg-foreground text-background" : "bg-surface border border-border text-foreground"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      m.content ? (
                        <Markdown>{m.content}</Markdown>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-muted">
                          <Loader2 size={14} className="animate-spin" /> thinking on 0G…
                        </span>
                      )
                    ) : (
                      m.content
                    )}
                  </div>
                  {m.meta && (
                    <div className={`mt-1 flex items-center gap-1 text-[10px] text-muted-2 ${m.role === "user" ? "justify-end" : ""}`}>
                      <ShieldCheck size={10} className="text-emerald-400/70" /> {m.meta}
                    </div>
                  )}
                </div>
              </div>
            ))}
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
              placeholder="Ask Mirrl anything… it remembers what matters"
              className="max-h-40 w-full resize-none bg-transparent px-2 pt-1 text-[15px] text-foreground placeholder:text-muted-2 outline-none"
            />
            {/* one row: attach on the left, model + speak + send on the right */}
            <div className="flex items-center gap-2 pt-1">
              <button className="shrink-0 rounded-md p-1.5 text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
                <Paperclip size={16} />
              </button>
              <div className="ml-auto flex min-w-0 items-center gap-1.5">
                <ModelSelect value={model} onChange={(m: OgModel) => setModel(m.model)} />
                <button className="shrink-0 rounded-md p-1.5 text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
                  <Globe size={15} />
                </button>
                <button className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
                  <Mic size={15} /> <span className="hidden sm:inline">Speak</span>
                </button>
                <button
                  onClick={send}
                  disabled={!input.trim() || sending}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition disabled:opacity-30"
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

      {/* collapsible chat rail — Recents lists all sessions; Chat History collapses it */}
      <div className="pointer-events-none absolute bottom-6 left-4 z-30 hidden md:block">
        <div className="pointer-events-auto flex w-60 flex-col rounded-2xl border border-border bg-surface/80 p-2 backdrop-blur">
          <div className="flex items-center justify-between px-1 pb-1">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label={sidebarOpen ? "Collapse" : "Expand"}
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
              <div className="max-h-64 space-y-0.5 overflow-y-auto">
                {sessions.length === 0 ? (
                  <div className="px-3 py-2 text-xs leading-relaxed text-muted-2">
                    Your conversations will show up here. Start one below.
                  </div>
                ) : (
                  sessions.map((s) => (
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
                        aria-label="Delete chat"
                        className="opacity-0 group-hover:opacity-100 text-muted-2 hover:text-foreground transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2">
              <Clock size={14} /> Chat History
              {sessions.length > 0 && <span className="text-muted-2">{sessions.length}</span>}
            </span>
            <ChevronUp size={14} className={`transition-transform ${sidebarOpen ? "" : "rotate-180"}`} />
          </button>
        </div>
      </div>
    </main>
  );
}
