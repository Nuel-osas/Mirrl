"use client";

import { useState } from "react";
import {
  Paperclip, AtSign, CheckSquare, MessageSquare, Sparkles,
  Globe, Mic, ArrowUp, Plus, ChevronUp,
} from "lucide-react";
import { ModelSelect } from "@/components/ModelSelect";
import { useMirrl } from "@/lib/store";
import type { OgModel } from "@/lib/og";

type Mode = "task" | "ask" | "remember";

export default function AgentsPage() {
  const { model, setModel } = useMirrl();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("ask");

  const modes: { id: Mode; label: string; icon: typeof CheckSquare }[] = [
    { id: "task", label: "Task", icon: CheckSquare },
    { id: "ask", label: "Ask", icon: MessageSquare },
    { id: "remember", label: "Remember", icon: Sparkles },
  ];

  return (
    <main className="relative flex flex-1 flex-col">
      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          {/* room header */}
          <div className="border-b border-border px-4 py-3">
            <div className="mx-auto max-w-3xl">
              <span className="text-sm">
                <span className="text-muted-2">#</span>
                <span className="text-foreground">no-room</span>
              </span>
            </div>
          </div>

          {/* empty state */}
          <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
            <p className="text-sm leading-relaxed text-muted">
              No task rooms yet. @mention an agent in the box below to
              <br />
              queue the first task.
            </p>
          </div>

          {/* composer */}
          <div className="mx-auto mb-6 w-full max-w-3xl px-4">
            <div className="rounded-2xl border border-border-strong bg-surface px-3 pt-3 pb-2">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder=" "
                className="max-h-40 w-full resize-none bg-transparent px-2 pt-1 text-[15px] text-foreground placeholder:text-muted-2 outline-none"
              />
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1">
                  <button className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
                    <Paperclip size={16} />
                  </button>
                  <button className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
                    <AtSign size={16} />
                  </button>
                  <div className="ml-1 flex rounded-lg bg-surface-2 p-0.5">
                    {modes.map((m) => {
                      const Icon = m.icon;
                      const active = mode === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setMode(m.id)}
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                            active
                              ? "bg-foreground text-background"
                              : "text-muted hover:text-foreground hover:bg-surface-2"
                          }`}
                        >
                          <Icon size={13} /> {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <ModelSelect value={model} onChange={(m: OgModel) => setModel(m.model)} />
                  <button className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
                    <Globe size={15} />
                  </button>
                  <button className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
                    <Mic size={15} /> Speak
                  </button>
                  <button className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background transition">
                    <ArrowUp size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* floating sidebar */}
        <div className="pointer-events-none absolute bottom-6 left-4 z-30">
          <div className="pointer-events-auto w-64 rounded-2xl border border-border bg-surface/80 p-2 backdrop-blur">
            <button className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-surface-2 transition-colors">
              <Plus size={15} /> New task room
            </button>

            <div className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-2">
              Task rooms
            </div>
            <p className="px-2 pb-1 text-xs text-muted">
              No rooms yet. @mention an agent below.
            </p>

            <div className="flex items-center justify-between px-2 pt-3 pb-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-2">Agents · 0</span>
              <button className="rounded-lg p-1 text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
                <Plus size={13} />
              </button>
            </div>

            <div className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-2">
              Direct
            </div>
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
              <span className="brand-grad h-7 w-7 shrink-0 rounded-full" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-foreground">You</span>
                <span className="truncate text-xs text-muted-2">director</span>
              </span>
            </div>

            <button className="mt-1 flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground transition-colors">
              <span className="flex items-center gap-2">
                Agents &amp; rooms
                <span className="rounded-lg bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-2">0</span>
              </span>
              <ChevronUp size={14} />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
