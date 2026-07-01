"use client";

import { useMemo, useState } from "react";
import {
  LayoutGrid,
  Activity,
  Plus,
  Search,
  Trash2,
  Save,
  Sparkles,
} from "lucide-react";
import { useMirrl } from "@/lib/store";
import { MemoryStatus, SignInGate } from "@/components/MemoryStatus";
import { ConsolidateButton } from "@/components/Consolidate";

type View = "grid" | "timeline";

function tierBadge(strength?: number) {
  const v = strength ?? 0.5;
  if (v >= 0.66) return { label: "durable", cls: "text-emerald-400 bg-emerald-400/15" };
  if (v >= 0.33) return { label: "active", cls: "text-[var(--brand-to,#7c5cff)] bg-[color-mix(in_srgb,var(--brand-to,#7c5cff)_18%,transparent)]" };
  return { label: "faded", cls: "text-muted-2 bg-surface-2" };
}

function relativeLabel(index: number, total: number) {
  if (total <= 1) return "just now";
  if (index === 0) return "just now";
  if (index === 1) return "moments ago";
  if (index < 4) return "earlier today";
  if (index < 8) return "this week";
  return "a while ago";
}

export default function MemoriesPage() {
  const { memories, addMemory, removeMemory, signedIn } = useMirrl();

  const [view, setView] = useState<View>("grid");
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("everything");
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const m of memories) {
      if (m.tag) set.add(m.tag);
    }
    set.delete("everything");
    return Array.from(set).sort();
  }, [memories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memories.filter((m) => {
      const matchesTag = activeTag === "everything" || m.tag === activeTag;
      const matchesQuery =
        !q || m.text.toLowerCase().includes(q) || m.tag.toLowerCase().includes(q);
      return matchesTag && matchesQuery;
    });
  }, [memories, query, activeTag]);

  function handleSave() {
    const t = draft.trim();
    if (!t) return;
    addMemory(t);
    setDraft("");
    setComposing(false);
  }

  if (!signedIn) {
    return (
      <SignInGate
        title="Your memories live here"
        subtitle="Sign in to see everything Mirrl has learned about you — and prove it's owned by you on 0G."
      />
    );
  }

  return (
    <main className="flex flex-1 flex-col overflow-y-auto px-6 py-6">
      <div className="mx-auto w-full max-w-6xl">
        {/* Header row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold text-foreground">Your memories</h1>

          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented toggle */}
            <div className="flex items-center rounded-lg border border-border bg-surface p-1">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === "grid"
                    ? "bg-foreground text-background"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Grid
              </button>
              <button
                type="button"
                onClick={() => setView("timeline")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === "timeline"
                    ? "bg-foreground text-background"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <Activity className="h-4 w-4" />
                Timeline
              </button>
            </div>

            {/* Consolidate (elastic brain sweep) */}
            <ConsolidateButton />

            {/* Build memory */}
            <button
              type="button"
              onClick={() => setComposing((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background transition-colors hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Build memory
            </button>
          </div>
        </div>

        {/* 0G ownership proof */}
        <div className="mt-4">
          <MemoryStatus />
        </div>

        {/* Inline composer */}
        {composing && (
          <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-muted" />
              New memory
            </div>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What should Mirrl remember?"
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-2 focus:border-border-strong"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setComposing(false);
                  setDraft("");
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!draft.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background transition-colors hover:opacity-90 disabled:opacity-40"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
          </div>
        )}

        {/* Second row: search + chips */}
        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your memory…"
              className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-2 focus:border-border-strong"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTag("everything")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTag === "everything"
                  ? "bg-foreground text-background"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              Everything
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  activeTag === tag
                    ? "bg-foreground text-background"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="mt-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
              <p className="text-lg font-bold text-foreground">Nothing here yet</p>
              <p className="text-sm text-muted">Try a different word.</p>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((m, i) => (
                <div
                  key={m.id}
                  className="group relative rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                >
                  <p className="text-sm leading-relaxed text-foreground">{m.text}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="rounded-lg bg-surface-2 px-2 py-0.5 text-xs font-medium capitalize text-muted">
                        {m.tag}
                      </span>
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-medium ${tierBadge(m.strength).cls}`}>
                        {m.verified ? "✓ " : ""}{tierBadge(m.strength).label}
                      </span>
                    </span>
                    <span className="text-xs text-muted-2">
                      {relativeLabel(i, filtered.length)}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete memory"
                    onClick={() => removeMemory(m.id)}
                    className="absolute right-2 top-2 rounded-lg p-1.5 text-muted-2 opacity-0 transition-colors hover:bg-surface-2 hover:text-foreground group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="ml-2 border-l border-border pl-6">
              {filtered.map((m, i) => (
                <div key={m.id} className="group relative pb-6 last:pb-0">
                  <span className="absolute -left-[1.9rem] top-1.5 h-2.5 w-2.5 rounded-full border border-border-strong bg-surface" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm leading-relaxed text-foreground">{m.text}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="rounded-lg bg-surface-2 px-2 py-0.5 text-xs font-medium capitalize text-muted">
                          {m.tag}
                        </span>
                        <span className="text-xs text-muted-2">
                          {relativeLabel(i, filtered.length)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete memory"
                      onClick={() => removeMemory(m.id)}
                      className="rounded-lg p-1.5 text-muted-2 opacity-0 transition-colors hover:bg-surface-2 hover:text-foreground group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
