"use client";

import { useState } from "react";
import {
  MessageSquare,
  Sparkles,
  Terminal,
  Box,
  Code,
  Bot,
  Wind,
  Plug,
  type LucideIcon,
} from "lucide-react";
import { useMirrl } from "@/lib/store";

type Connector = {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
};

const CONNECTORS: Connector[] = [
  {
    id: "chatgpt",
    title: "ChatGPT",
    icon: MessageSquare,
    description: "Reach your Mirrl memory from ChatGPT — and let every chat build it.",
  },
  {
    id: "claude",
    title: "Claude",
    icon: Sparkles,
    description: "Add Mirrl as a connector in Claude to recall and write memory in any chat.",
  },
  {
    id: "claude-code",
    title: "Claude Code",
    icon: Terminal,
    description: "Your conventions, decisions and project context, remembered in the CLI.",
  },
  {
    id: "cursor",
    title: "Cursor",
    icon: Box,
    description: "Persistent memory and MCP tools inside the editor.",
  },
  {
    id: "vscode",
    title: "VS Code",
    icon: Code,
    description: "Bring Mirrl memory into Copilot Chat and MCP-aware extensions.",
  },
  {
    id: "codex",
    title: "Codex",
    icon: Bot,
    description: "Persistent memory for the Codex CLI.",
  },
  {
    id: "windsurf",
    title: "Windsurf",
    icon: Wind,
    description: "Mirrl memory and tools inside Windsurf.",
  },
  {
    id: "cline",
    title: "Cline",
    icon: Plug,
    description: "Give Cline a durable memory across sessions.",
  },
];

export default function IntegrationsPage() {
  const { signedIn } = useMirrl();
  const [connected, setConnected] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setConnected((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <main className="flex flex-1 flex-col overflow-y-auto px-6 py-8">
      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          <div className="grid max-w-5xl mx-auto w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONNECTORS.map((c) => {
              const Icon = c.icon;
              const isConnected = !!connected[c.id];
              return (
                <div
                  key={c.id}
                  className="bg-surface border border-border rounded-2xl p-5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 border border-border">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <h3 className="mt-3 font-bold text-foreground">{c.title}</h3>
                  <p className="mt-1 text-sm text-muted">{c.description}</p>
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={
                      isConnected
                        ? "mt-3 rounded-lg bg-foreground px-3 py-1.5 text-sm text-background"
                        : "mt-3 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-2"
                    }
                  >
                    {isConnected ? "Connected" : "Connect"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="max-w-5xl mx-auto w-full mt-6">
            <div className="bg-surface border border-border rounded-2xl p-5">
              <h2 className="font-bold text-foreground">Authorize MCP</h2>
              <p className="mt-1 text-sm text-muted">
                One click grants your MCP everything it needs: your profile, your
                memory, and your shared agent workspace (board + bus). You can
                revoke anytime.
              </p>
              <p className="mt-3 font-mono text-sm text-muted-2">
                MCP wallet · 0x552fb04f…39efa6
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-foreground px-3 py-1.5 text-sm text-background"
                >
                  Authorize MCP
                </button>
                <button
                  type="button"
                  disabled
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-2 disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">
                {signedIn
                  ? "MCP authorized."
                  : "Sign in to authorize your MCP."}
              </p>

              <p className="mt-4 text-[10px] uppercase tracking-wider text-muted-2">
                Connected apps
              </p>
              <p className="mt-1 text-sm text-muted">
                No apps connected yet. Add Mirrl as a custom connector in Claude
                to connect.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
