"use client";

import { useState } from "react";
import {
  MessageSquare, Sparkles, Terminal, Box, Code, Bot, Wind, Plug,
  Check, Copy, Loader2, KeyRound, ChevronDown, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

type Connector = { id: string; title: string; icon: LucideIcon; description: string };

const CONNECTORS: Connector[] = [
  { id: "chatgpt", title: "ChatGPT", icon: MessageSquare, description: "Reach your Mirrl memory from ChatGPT — and let every chat build it." },
  { id: "claude", title: "Claude", icon: Sparkles, description: "Add Mirrl as a connector in Claude to recall and write memory in any chat." },
  { id: "claude-code", title: "Claude Code", icon: Terminal, description: "Your conventions, decisions and project context, remembered in the CLI." },
  { id: "cursor", title: "Cursor", icon: Box, description: "Persistent memory and MCP tools inside the editor." },
  { id: "vscode", title: "VS Code", icon: Code, description: "Bring Mirrl memory into Copilot Chat and MCP-aware extensions." },
  { id: "codex", title: "Codex", icon: Bot, description: "Persistent memory for the Codex CLI." },
  { id: "windsurf", title: "Windsurf", icon: Wind, description: "Mirrl memory and tools inside Windsurf." },
  { id: "cline", title: "Cline", icon: Plug, description: "Give Cline a durable memory across sessions." },
];

function configSnippet(mcpUrl: string, token: string) {
  return JSON.stringify(
    { mcpServers: { mirrl: { url: mcpUrl, headers: { Authorization: `Bearer ${token || "<authorize-first>"}` } } } },
    null,
    2,
  );
}

export default function IntegrationsPage() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const short = user ? `${user.address.slice(0, 6)}…${user.address.slice(-4)}` : null;

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {}
  }

  async function authorize() {
    if (!user) return;
    setBusy(true);
    try {
      const res = await fetch("/api/mcp/token", { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        setToken(d.token);
        setMcpUrl(d.mcpUrl);
      }
    } finally {
      setBusy(false);
    }
  }

  function revoke() {
    setToken("");
    setOpen(null);
  }

  return (
    <main className="flex flex-1 flex-col overflow-y-auto px-6 py-8">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="mt-1 text-sm text-muted">
          Reach your Mirrl memory from any AI tool over MCP. Authorize once, paste the config, and your context follows you everywhere.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONNECTORS.map((c) => {
            const Icon = c.icon;
            const expanded = open === c.id;
            return (
              <div key={c.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-2">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  {token && <Check size={15} className="text-emerald-400/80" />}
                </div>
                <h3 className="mt-3 font-semibold text-foreground">{c.title}</h3>
                <p className="mt-1 text-sm text-muted">{c.description}</p>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : c.id)}
                  disabled={!user}
                  className="mt-3 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2 disabled:opacity-40"
                >
                  Connect <ChevronDown size={13} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>

                {expanded && (
                  <div className="mt-3 rounded-lg border border-border bg-background/50 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wide text-muted-2">{c.title} · MCP config</span>
                      <button
                        onClick={() => copy(c.id, configSnippet(mcpUrl, token))}
                        className="flex items-center gap-1 text-[10px] text-muted hover:text-foreground"
                      >
                        {copied === c.id ? <Check size={11} /> : <Copy size={11} />} copy
                      </button>
                    </div>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-muted">
                      {configSnippet(mcpUrl, token)}
                    </pre>
                    {!token && <p className="mt-1 text-[10px] text-amber-400/80">Authorize MCP below to fill in your token.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Authorize MCP */}
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-muted" />
            <h2 className="font-semibold">Authorize MCP</h2>
          </div>
          <p className="mt-1 text-sm text-muted">
            One token grants an MCP client your profile, your memory and your agent workspace — scoped to your wallet. Revoke anytime.
          </p>

          {short && <p className="mt-3 font-mono text-xs text-muted-2">MCP wallet · {short}</p>}

          {!user ? (
            <p className="mt-3 text-sm text-amber-400/80">Sign in (account menu) to authorize your MCP.</p>
          ) : (
            <>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={authorize}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
                >
                  {busy && <Loader2 size={13} className="animate-spin" />}
                  {token ? "Re-authorize" : "Authorize MCP"}
                </button>
                <button
                  onClick={revoke}
                  disabled={!token}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2 disabled:opacity-40"
                >
                  Revoke
                </button>
              </div>

              {token && (
                <div className="mt-3 rounded-lg border border-border bg-background/50 p-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wide text-muted-2">Your MCP access token</span>
                    <button onClick={() => copy("token", token)} className="flex items-center gap-1 text-[10px] text-muted hover:text-foreground">
                      {copied === "token" ? <Check size={11} /> : <Copy size={11} />} copy
                    </button>
                  </div>
                  <p className="break-all font-mono text-[11px] text-foreground">{token.slice(0, 24)}…{token.slice(-12)}</p>
                  <p className="mt-1.5 text-[10px] text-muted-2">Endpoint: <span className="font-mono">{mcpUrl}</span></p>
                </div>
              )}
            </>
          )}

          <p className="mt-4 text-[10px] uppercase tracking-wider text-muted-2">Connected apps</p>
          <p className="mt-1 text-sm text-muted">
            {token ? "Token issued — paste a connector config above into your AI tool to connect." : "No apps connected yet."}
          </p>
        </div>
      </div>
    </main>
  );
}
