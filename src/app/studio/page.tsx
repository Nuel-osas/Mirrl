"use client";

import { useState } from "react";
import {
  Paperclip,
  Sparkles,
  Repeat,
  ChevronDown,
  Globe,
  ArrowRight,
  Copy,
  Download,
  Wand2,
} from "lucide-react";
import { useMirrl } from "@/lib/store";
import { ModelSelect } from "@/components/ModelSelect";
import type { OgModel } from "@/lib/og";

type Result = { prompt: string; tokens: number };

export default function StudioPage() {
  const { memories, model, setModel } = useMirrl();
  const [input, setInput] = useState("");
  const [results, setResults] = useState<Result[]>([]);

  function send() {
    const text = input.trim();
    if (!text) return;
    const prompt = `You are my personal assistant. Adopt the standing preferences and voice below as your defaults...\n\nTask: ${text}\n\n- mirrl · ${memories.length} memories grounded`;
    const tokens = Math.round(prompt.length / 4);
    setResults((prev) => [...prev, { prompt, tokens }]);
    setInput("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const total = memories.length;

  return (
    <main className="flex flex-1 flex-col">
      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          {/* Conversation thread */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 py-6">
              {results.length === 0 ? (
                <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center text-muted">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-muted-2">
                    <Wand2 className="h-5 w-5" />
                  </div>
                  <p className="text-sm">
                    Generate a prompt grounded in your memory.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {results.map((r, i) => (
                    <div key={i} className="flex flex-col gap-4">
                      {/* User request bubble */}
                      <div className="flex items-start justify-end gap-3">
                        <div className="max-w-[80%] rounded-2xl bg-surface-2 px-4 py-2 text-sm text-foreground">
                          {r.prompt.split("\n\n")[1]?.replace(/^Task:\s*/, "") ??
                            r.prompt}
                        </div>
                        <div className="brand-grad mt-0.5 h-7 w-7 shrink-0 rounded-full" />
                      </div>

                      {/* Assistant card */}
                      <div className="rounded-2xl border border-border bg-surface p-4">
                        <div className="mb-2 text-xs text-muted">
                          ~{r.tokens} tokens
                        </div>
                        <div className="whitespace-pre-line text-sm text-foreground">
                          {r.prompt}
                        </div>

                        {/* Button row */}
                        <div className="mt-4 flex items-center gap-2">
                          <div className="flex items-center overflow-hidden rounded-lg border border-border">
                            <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-foreground">
                              <Copy className="h-3.5 w-3.5" />
                              Copy content
                            </button>
                            <button className="border-l border-border px-1.5 py-1.5 text-muted hover:bg-surface-2 hover:text-foreground">
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <button className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-foreground">
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </button>
                        </div>

                        {/* Footer */}
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                          <span>
                            Grounded in {total} of {total} memories
                          </span>
                          <span className="text-muted-2">·</span>
                          <button className="text-muted hover:text-foreground">
                            Choose
                          </button>
                          <button className="text-muted hover:text-foreground">
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="mx-auto w-full max-w-3xl px-4 pb-6">
            <div className="rounded-2xl border border-border-strong bg-surface px-3 pb-2 pt-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                placeholder="What do you need a prompt for? e.g. a hero image for my notes app"
                className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-2 focus:outline-none"
              />

              <div className="mt-2 flex items-center justify-between gap-2">
                {/* Left controls */}
                <div className="flex items-center gap-2">
                  <button className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground">
                    <Paperclip className="h-4 w-4" />
                  </button>

                  {/* Segmented Prompt | Loop */}
                  <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-0.5">
                    <button className="flex items-center gap-1.5 rounded-md bg-foreground px-2 py-1 text-xs text-background">
                      <Sparkles className="h-3.5 w-3.5" />
                      Prompt
                    </button>
                    <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-foreground">
                      <Repeat className="h-3.5 w-3.5" />
                      Loop
                    </button>
                  </div>

                  {/* Dropdown chips */}
                  <button className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs text-foreground">
                    <span className="text-muted">For</span>
                    Text
                    <ChevronDown className="h-3 w-3 text-muted" />
                  </button>
                  <button className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs text-foreground">
                    <span className="text-muted">Style</span>
                    Role prompt
                    <ChevronDown className="h-3 w-3 text-muted" />
                  </button>
                  <button className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs text-foreground">
                    <span className="text-muted">Type</span>
                    Plain
                    <ChevronDown className="h-3 w-3 text-muted" />
                  </button>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2">
                  <ModelSelect
                    value={model}
                    onChange={(m: OgModel) => setModel(m.model)}
                  />
                  <button className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground">
                    <Globe className="h-4 w-4" />
                  </button>
                  <button
                    onClick={send}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
