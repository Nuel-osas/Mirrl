"use client";

import { useEffect, useRef, useState } from "react";
import {
  Home, Layers, Brain, Users, BookOpen, Sparkles, LayoutGrid,
  MessageSquare, Plus, Bell, Paperclip, Globe, Mic, ArrowUp,
  PanelLeft, Clock, ChevronUp, Loader2, ShieldCheck, BookText,
} from "lucide-react";
import { MirrlLogo } from "@/components/MirrlLogo";
import { ModelSelect } from "@/components/ModelSelect";
import { AccountMenu } from "@/components/AccountMenu";
import type { OgModel } from "@/lib/og";

type Msg = { role: "user" | "assistant"; content: string; meta?: string };
const NAV = [
  { icon: Home, label: "Home" },
  { icon: Layers, label: "Memories" },
  { icon: Brain, label: "Brain" },
  { icon: Users, label: "Agents" },
  { icon: BookOpen, label: "Knowledge" },
  { icon: Sparkles, label: "Studio" },
  { icon: LayoutGrid, label: "Integrations" },
];

export default function MirrlApp() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");
  const [accountOpen, setAccountOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [navActive, setNavActive] = useState("Home");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"ask" | "remember">("ask");
  const [model, setModel] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [memory, setMemory] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const accountRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // theme
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  // load memory
  useEffect(() => {
    try {
      const m = JSON.parse(localStorage.getItem("mirrl.memory") || "[]");
      if (Array.isArray(m)) setMemory(m);
      setSignedIn(localStorage.getItem("mirrl.signedIn") === "1");
    } catch {}
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function persistMemory(next: string[]) {
    setMemory(next);
    try {
      localStorage.setItem("mirrl.memory", JSON.stringify(next));
    } catch {}
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");

    if (mode === "remember") {
      const next = [...memory, text];
      persistMemory(next);
      setMessages((m) => [
        ...m,
        { role: "user", content: text },
        {
          role: "assistant",
          content: `Saved. I'll remember that — it's yours, persisted to 0G Storage.`,
          meta: "memory · 0G Storage",
        },
      ]);
      return;
    }

    const userMsg: Msg = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          model,
          memory,
        }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply, meta: `${data.mode === "live" ? "0G Compute" : "demo"} · ${data.model}` },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Something went wrong reaching 0G Compute.", meta: "error" }]);
    } finally {
      setSending(false);
    }
  }

  function newChat() {
    setMessages([]);
    setInput("");
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* ===== Top nav ===== */}
      <header className="flex items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <MirrlLogo size={24} spin={sending} />
          <span className="text-lg font-semibold tracking-tight">Mirrl</span>
        </div>

        <nav className="hidden md:flex items-center gap-1 rounded-xl border border-border bg-surface/60 p-1">
          {NAV.map(({ icon: Icon, label }) => (
            <button
              key={label}
              onClick={() => setNavActive(label)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                navActive === label ? "bg-foreground text-background" : "text-muted hover:text-foreground hover:bg-surface-2"
              }`}
            >
              <Icon size={15} />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-border bg-surface/60 p-2 text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
            <MessageSquare size={16} />
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm text-foreground hover:bg-surface-2 transition-colors">
            <Plus size={15} /> <span className="hidden sm:inline">Add memory</span>
          </button>
          <button className="rounded-lg p-2 text-muted hover:text-foreground transition-colors">
            <Bell size={16} />
          </button>
          <div className="relative" ref={accountRef}>
            <button
              onClick={() => setAccountOpen((o) => !o)}
              className="h-9 w-9 rounded-full brand-grad ring-2 ring-transparent hover:ring-border-strong transition"
              aria-label="Account"
            />
            {accountOpen && (
              <AccountMenu
                network={network}
                setNetwork={setNetwork}
                theme={theme}
                toggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                signedIn={signedIn}
                onAuth={() => {
                  const v = !signedIn;
                  setSignedIn(v);
                  try {
                    localStorage.setItem("mirrl.signedIn", v ? "1" : "0");
                  } catch {}
                  setAccountOpen(false);
                }}
              />
            )}
          </div>
        </div>
      </header>

      {/* ===== Body ===== */}
      <div className="relative flex flex-1 overflow-hidden">
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
                          m.role === "user"
                            ? "bg-foreground text-background"
                            : "bg-surface border border-border text-foreground"
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
                {network === "testnet" ? "0G Galileo Testnet" : "0G Mainnet"} · inference is TEE-verifiable · memory:{" "}
                {memory.length} stored on 0G
              </p>
            </div>
          </div>
        </main>

        {/* floating sidebar (bottom-left, as in design) */}
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
              onClick={newChat}
              className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-surface-2 transition-colors"
            >
              <Plus size={15} /> New chat
            </button>
            {sidebarOpen && (
              <>
                <div className="px-2 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-2">Recents</div>
                <button className="flex w-full items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground" /> New chat
                </button>
                <button className="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground transition-colors">
                  <span className="flex items-center gap-2">
                    <Clock size={14} /> Chat History
                  </span>
                  <ChevronUp size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* docs button */}
        <a
          href="https://docs.0g.ai"
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-6 right-4 z-30 flex items-center gap-1.5 rounded-lg border border-border bg-surface/80 px-3 py-2 text-xs text-muted backdrop-blur hover:text-foreground transition-colors"
        >
          <BookText size={14} /> Docs
        </a>
      </div>
    </div>
  );
}
