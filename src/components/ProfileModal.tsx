"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Copy, RefreshCw, Loader2, Wallet, Coins, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { useMirrl } from "@/lib/store";
import { prettyModel } from "@/lib/og";

type FundedModel = { model: string; provider: string; balance: number };
type State = {
  walletAddress: string;
  native: number;
  ledger: { total: number; available: number; locked: number };
  models: FundedModel[];
};

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

export function ProfileModal() {
  const { profileOpen, closeProfile, network } = useMirrl();
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(false);
  const [reclaiming, setReclaiming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch(`/api/wallet?net=${network}`).then((r) => r.json());
      if (d.signedIn && !d.error) setState(d);
      else if (d.error) toast.error(d.error);
    } catch {
      toast.error("Couldn't load wallet");
    } finally {
      setLoading(false);
    }
  }, [network]);

  useEffect(() => {
    if (profileOpen) load();
    else setState(null);
  }, [profileOpen, load]);

  if (!profileOpen) return null;

  async function reclaim() {
    setReclaiming(true);
    try {
      const res = await fetch(`/api/wallet?net=${network}`, { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        toast.success("Reclaim sent", { description: "0G returns to your main balance after the on-chain lock period." });
        load();
      } else {
        toast.error(d.error ?? "Reclaim failed");
      }
    } catch {
      toast.error("Reclaim failed");
    } finally {
      setReclaiming(false);
    }
  }

  const short = state ? `${state.walletAddress.slice(0, 6)}…${state.walletAddress.slice(-4)}` : "";

  return (
    <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={closeProfile}>
      <div
        className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-strong bg-surface p-6 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={closeProfile} aria-label="Close" className="absolute right-3 top-3 rounded-md p-1 text-muted-2 hover:bg-surface-2 hover:text-foreground">
          <X size={16} />
        </button>

        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-[var(--brand,#7c5cff)]" />
          <h2 className="text-lg font-semibold">Your 0G wallet</h2>
          <button onClick={load} className="ml-auto mr-6 rounded-md p-1 text-muted-2 hover:text-foreground" title="Refresh">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {state && (
          <button
            onClick={() => { navigator.clipboard?.writeText(state.walletAddress); toast.success("Address copied"); }}
            className="mt-1 flex items-center gap-1.5 font-mono text-xs text-muted hover:text-foreground"
          >
            {short} <Copy size={12} />
          </button>
        )}

        {!state && loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        )}

        {state && (
          <>
            {/* balances */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="Wallet" value={fmt(state.native)} hint="spendable" />
              <Stat label="Available" value={fmt(state.ledger.available)} hint="in ledger" />
              <Stat label="In models" value={fmt(state.ledger.locked)} hint="locked" />
            </div>

            {/* per-model sub-accounts */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-2">
                <Coins size={12} /> Funded models
              </div>
              {state.models.length === 0 ? (
                <p className="rounded-lg bg-surface-2 px-3 py-3 text-xs text-muted">
                  No models funded yet. Selecting a model funds its sub-account with ~1 0G the first time you use it.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {state.models.map((m) => (
                    <div key={m.provider} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
                      <span className="truncate text-sm text-foreground">{prettyModel(m.model)}</span>
                      <span className="shrink-0 font-mono text-xs text-muted">{fmt(m.balance)} 0G</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* reclaim */}
            {state.ledger.locked > 0 && (
              <>
                <button
                  onClick={reclaim}
                  disabled={reclaiming}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface-2 px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-border disabled:opacity-60"
                >
                  {reclaiming ? <Loader2 size={15} className="animate-spin" /> : <ArrowDownToLine size={15} />}
                  Reclaim all 0G from models
                </button>
                <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-2">
                  Pulls every model's 0G back to your main balance. 0G time-locks reclaimed funds for a short period before they're spendable again.
                </p>
              </>
            )}

            <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
              Each model runs on its own 0G Compute sub-account, funded the first time you use it (~1 0G). That 0G stays yours — reclaim it here anytime.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2.5 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-2">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold text-foreground" title={value}>{value}</div>
      <div className="text-[10px] text-muted-2">{hint}</div>
    </div>
  );
}
