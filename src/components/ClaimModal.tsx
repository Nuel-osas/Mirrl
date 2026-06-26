"use client";

import { useEffect, useState } from "react";
import { X, Gift, Loader2, ShieldCheck, BrainCircuit } from "lucide-react";
import { toast } from "sonner";
import { useMirrl } from "@/lib/store";
import { MirrlLogo } from "@/components/MirrlLogo";

// Shown once a new (or not-yet-claimed) user connects Gmail: a warm welcome that
// hands them free test 0G so they can chat live immediately — no crypto needed.
export function ClaimModal() {
  const { claimOpen, closeClaim } = useMirrl();
  const [amount, setAmount] = useState("5");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!claimOpen) return;
    setReady(false);
    fetch("/api/faucet")
      .then((r) => r.json())
      .then((d) => {
        // only prompt signed-in users who can still claim
        if (!d.signedIn || d.claimed || !d.enabled) {
          closeClaim();
          return;
        }
        setAmount(d.amount ?? "5");
        setReady(true);
      })
      .catch(() => closeClaim());
  }, [claimOpen, closeClaim]);

  if (!claimOpen || !ready) return null;

  async function claim() {
    setLoading(true);
    try {
      const res = await fetch("/api/faucet", { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        toast.success(`${d.amount} 0G sent to your wallet`, { description: "Ask anything — you're live on 0G." });
        closeClaim();
      } else {
        toast.error(d.error ?? "Claim failed");
        setLoading(false);
      }
    } catch {
      toast.error("Claim failed");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={closeClaim}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-border-strong bg-surface p-6 text-center shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeClaim}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-2 hover:bg-surface-2 hover:text-foreground"
        >
          <X size={16} />
        </button>

        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl brand-grad">
          <MirrlLogo size={24} />
        </div>
        <h2 className="text-lg font-semibold">Welcome to Mirrl 🎉</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
          You now have your own private 0G wallet. Claim <span className="font-semibold text-foreground">{amount} free 0G</span> to
          start chatting live — no crypto required.
        </p>

        <div className="mt-4 space-y-2 text-left text-xs text-muted">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="shrink-0 text-emerald-400" /> Private, verifiable inference on 0G Compute
          </div>
          <div className="flex items-center gap-2">
            <BrainCircuit size={14} className="shrink-0 text-[var(--brand,#7c5cff)]" /> A memory you own — yours forever on 0G
          </div>
        </div>

        <button
          onClick={claim}
          disabled={loading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg brand-grad px-3 py-2.5 text-sm font-medium text-white transition disabled:opacity-60"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Gift size={15} />}
          Claim {amount} 0G
        </button>
        <button onClick={closeClaim} className="mt-2 text-xs text-muted hover:text-foreground">
          Maybe later
        </button>
      </div>
    </div>
  );
}
