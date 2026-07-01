"use client";

import { useState } from "react";
import { Sparkles, Loader2, GitMerge, Scissors, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useMirrl } from "@/lib/store";

type Diff = {
  before: number;
  after: number;
  foldedGroups: number;
  foldedAway: number;
  pruned: number;
  promoted: number;
  faded: number;
  folds: { keep: string; drop: string[] }[];
  prunes: string[];
};

// The "elastic brain" trigger: run a consolidation sweep (fold duplicates + prune
// noise), show the inspectable diff, and apply only when the user confirms.
export function ConsolidateButton() {
  const { reloadMemories } = useMirrl();
  const [diff, setDiff] = useState<Diff | null>(null);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);

  async function sweep() {
    setRunning(true);
    try {
      const d: Diff = await fetch("/api/memory/consolidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: false }),
      }).then((r) => r.json());
      if (d.foldedAway + d.pruned + d.promoted === 0) {
        toast.success("Memory is already clean", { description: "No duplicates, noise, or promotions to apply." });
        setDiff(null);
      } else {
        setDiff(d);
      }
    } catch {
      toast.error("Consolidation failed");
    } finally {
      setRunning(false);
    }
  }

  async function apply() {
    setApplying(true);
    try {
      const d: Diff = await fetch("/api/memory/consolidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true }),
      }).then((r) => r.json());
      await reloadMemories();
      toast.success(`Consolidated → ${d.after} durable memories`, {
        description: `Folded ${d.foldedAway} duplicate${d.foldedAway === 1 ? "" : "s"}, pruned ${d.pruned} noise.`,
      });
      setDiff(null);
    } catch {
      toast.error("Couldn't apply");
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={sweep}
        disabled={running}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
        title="Fold duplicates and prune noise (review before applying)"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Consolidate
      </button>

      {diff && (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setDiff(null)}>
          <div
            className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-strong bg-surface p-6 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setDiff(null)} className="absolute right-3 top-3 rounded-md p-1 text-muted-2 hover:bg-surface-2 hover:text-foreground">
              <X size={16} />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[var(--brand-to,#7c5cff)]" />
              <h2 className="text-lg font-semibold">Consolidation sweep</h2>
            </div>
            <p className="mt-1 text-sm text-muted">
              <b className="text-foreground">{diff.before}</b> → <b className="text-foreground">{diff.after}</b> memories ·
              fold <b className="text-foreground">{diff.foldedAway}</b> · prune <b className="text-foreground">{diff.pruned}</b> ·
              promote <b className="text-emerald-400">{diff.promoted}</b>
            </p>

            {diff.folds.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-2">
                  <GitMerge size={12} /> Fold duplicates
                </div>
                <div className="space-y-2">
                  {diff.folds.map((f, i) => (
                    <div key={i} className="rounded-lg bg-surface-2 p-3 text-xs">
                      <p className="text-foreground">✓ {f.keep}</p>
                      {f.drop.map((d, j) => (
                        <p key={j} className="mt-1 text-muted-2 line-through">{d}</p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {diff.prunes.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-2">
                  <Scissors size={12} /> Prune noise
                </div>
                <div className="space-y-1">
                  {diff.prunes.map((p, i) => (
                    <p key={i} className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted-2 line-through">{p}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setDiff(null)} className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground">
                Cancel
              </button>
              <button
                onClick={apply}
                disabled={applying}
                className="flex items-center gap-1.5 rounded-lg brand-grad px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Apply sweep
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
