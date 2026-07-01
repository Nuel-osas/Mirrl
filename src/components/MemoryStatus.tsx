"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, ShieldCheck, UploadCloud, Loader2, Copy, Lock } from "lucide-react";
import { toast } from "sonner";
import { useMirrl } from "@/lib/store";

type Status = { cached: number; version: number; rootHash: string | null; live: boolean };

export function useMemoryStatus() {
  const { signedIn } = useMirrl();
  const [status, setStatus] = useState<Status | null>(null);
  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      setStatus(await fetch("/api/memory/status").then((r) => r.json()));
    } catch {}
  }, [signedIn]);
  useEffect(() => {
    load();
  }, [load]);
  return { status, reload: load };
}

// The "you own it on 0G" proof bar: cache size, committed version, the owned 0G
// Storage root, and a one-click seal-to-0G. Shared by Memories and Brain.
export function MemoryStatus({ onSynced }: { onSynced?: () => void }) {
  const { commitMemory } = useMirrl();
  const { status, reload } = useMemoryStatus();
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    toast.info("Sealing your memory to 0G…", { description: "Consolidate → encrypt → upload → record ownership." });
    try {
      const r = await commitMemory();
      await reload();
      onSynced?.();
      if (r?.committed) {
        toast.success(`Committed v${r.version ?? "?"} to 0G`, {
          description: r.registered ? "Ownership recorded on 0G Chain." : r.live ? "Live on 0G Storage." : "Saved.",
        });
      } else {
        toast(r?.note ?? "Nothing new to commit yet.");
      }
    } catch {
      toast.error("Couldn't sync to 0G");
    } finally {
      setSyncing(false);
    }
  }

  const root = status?.rootHash;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
      <span className="flex items-center gap-1.5 text-sm text-foreground">
        <Database size={15} className="text-[var(--brand-to,#7c5cff)]" />
        <b>{status?.cached ?? 0}</b> in working memory
      </span>
      <span className="text-muted-2">·</span>
      {status && status.version > 0 ? (
        <span className="flex items-center gap-1.5 text-sm text-muted">
          committed <b className="text-foreground">v{status.version}</b> to 0G
          {status.live && (
            <span className="ml-1 flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              <ShieldCheck size={11} /> live
            </span>
          )}
        </span>
      ) : (
        <span className="text-sm text-muted">not yet committed to 0G</span>
      )}

      {root && (
        <button
          onClick={() => {
            navigator.clipboard?.writeText(root);
            toast.success("Root hash copied");
          }}
          title={root}
          className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs text-muted transition hover:text-foreground"
        >
          <Lock size={11} /> {root.slice(0, 8)}…{root.slice(-6)} <Copy size={11} />
        </button>
      )}

      <button
        onClick={sync}
        disabled={syncing}
        className="ml-auto flex items-center gap-1.5 rounded-lg brand-grad px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {syncing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
        Sync to 0G
      </button>
    </div>
  );
}

// Full-page sign-in prompt for gated pages when the user isn't signed in.
export function SignInGate({ title, subtitle }: { title: string; subtitle: string }) {
  const { openSignIn } = useMirrl();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl brand-grad">
        <Lock size={22} className="text-white" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="max-w-sm text-sm text-muted">{subtitle}</p>
      <button
        onClick={openSignIn}
        className="mt-2 rounded-lg brand-grad px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
      >
        Sign in to continue
      </button>
    </div>
  );
}
