"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Settings, LogOut, Wallet, Copy, Gift, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useMirrl } from "@/lib/store";
import { GoogleSignIn } from "@/components/GoogleSignIn";

export function AccountMenu({
  network,
  setNetwork,
  theme,
  toggleTheme,
}: {
  network: "testnet" | "mainnet";
  setNetwork: (n: "testnet" | "mainnet") => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}) {
  const { user, signOut } = useAuth();
  const { openProfile } = useMirrl();

  // test-token faucet
  const [faucet, setFaucet] = useState<{ claimed: boolean; amount: string; enabled: boolean; loading: boolean }>({
    claimed: false, amount: "5", enabled: false, loading: false,
  });
  useEffect(() => {
    if (!user) return;
    fetch("/api/faucet")
      .then((r) => r.json())
      .then((d) => setFaucet((f) => ({ ...f, claimed: !!d.claimed, amount: d.amount ?? "5", enabled: !!d.enabled })))
      .catch(() => {});
  }, [user]);

  async function claimTokens() {
    setFaucet((f) => ({ ...f, loading: true }));
    try {
      const res = await fetch("/api/faucet", { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        setFaucet((f) => ({ ...f, claimed: true, loading: false }));
        toast.success(`${d.amount} 0G sent to your wallet`, { description: "Send a message to go live." });
      } else {
        setFaucet((f) => ({ ...f, claimed: d.claimed ?? f.claimed, loading: false }));
        toast.error(d.error ?? "Claim failed");
      }
    } catch {
      setFaucet((f) => ({ ...f, loading: false }));
      toast.error("Claim failed");
    }
  }

  // custodial (Google) wallet wins; otherwise external wallet
  const addr = user?.address ?? null;
  const short = addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : null;
  const headline = user?.email ?? short ?? "Free · just you";

  return (
    <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-border-strong bg-surface p-2 shadow-2xl shadow-black/50 z-50">
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="h-9 w-9 shrink-0 rounded-full brand-grad" />
        <div className="min-w-0">
          <div className="text-xs text-muted">Account</div>
          <div className="truncate text-sm font-medium">{headline}</div>
        </div>
      </div>

      {/* custodial 0G wallet address + deposit hint */}
      {addr && (
        <button
          onClick={() => navigator.clipboard?.writeText(addr)}
          className="mb-1 flex w-full items-center justify-between gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-left transition-colors hover:bg-border"
          title="Copy your 0G address — deposit 0G here to pay for inference & storage"
        >
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-wide text-muted-2">Your 0G wallet</span>
            <span className="block truncate font-mono text-xs text-foreground">{short}</span>
          </span>
          <Copy size={13} className="shrink-0 text-muted-2" />
        </button>
      )}

      {/* claim free test 0G */}
      {user && faucet.enabled && (
        faucet.claimed ? (
          <div className="mb-1 flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1.5 text-xs text-emerald-400">
            <Check size={13} /> {faucet.amount} 0G claimed — send a message to go live
          </div>
        ) : (
          <button
            onClick={claimTokens}
            disabled={faucet.loading}
            className="mb-1 flex w-full items-center justify-center gap-1.5 rounded-lg brand-grad px-2.5 py-2 text-xs font-medium text-white transition disabled:opacity-60"
          >
            {faucet.loading ? <Loader2 size={13} className="animate-spin" /> : <Gift size={13} />}
            Claim {faucet.amount} 0G to test live
          </button>
        )
      )}

      <div className="mt-1 mb-1.5 flex rounded-lg bg-surface-2 p-0.5">
        <button
          onClick={() => setNetwork("testnet")}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            network === "testnet" ? "bg-background text-foreground shadow" : "text-muted hover:text-foreground"
          }`}
        >
          Testnet
        </button>
        <button
          onClick={() => setNetwork("mainnet")}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            network === "mainnet" ? "bg-background text-foreground shadow" : "text-muted hover:text-foreground"
          }`}
        >
          Mainnet
        </button>
      </div>

      <MenuItem icon={theme === "dark" ? Sun : Moon} label={theme === "dark" ? "Light mode" : "Dark mode"} onClick={toggleTheme} />
      {user && <MenuItem icon={Wallet} label="Wallet & funding" onClick={openProfile} highlight />}
      <MenuItem icon={Settings} label="Settings" />

      <div className="my-1 border-t border-border" />

      {user ? (
        <MenuItem icon={LogOut} label="Sign out" onClick={() => signOut()} />
      ) : (
        <div className="flex justify-center px-1 pt-1">
          <GoogleSignIn />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  highlight,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick?: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
        highlight ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      <Icon size={15} className="opacity-80" />
      {label}
    </button>
  );
}
