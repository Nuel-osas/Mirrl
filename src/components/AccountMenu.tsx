"use client";

import { Sun, Moon, User, Settings, LogIn, LogOut } from "lucide-react";

export function AccountMenu({
  network,
  setNetwork,
  theme,
  toggleTheme,
  signedIn,
  onAuth,
}: {
  network: "testnet" | "mainnet";
  setNetwork: (n: "testnet" | "mainnet") => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
  signedIn: boolean;
  onAuth: () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-border-strong bg-surface p-2 shadow-2xl shadow-black/50 z-50">
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="h-9 w-9 rounded-full brand-grad" />
        <div className="min-w-0">
          <div className="text-xs text-muted">Account</div>
          <div className="text-sm font-medium truncate">{signedIn ? "you.0g" : "Free · just you"}</div>
        </div>
      </div>

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
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
            network === "mainnet" ? "bg-background text-foreground shadow" : "text-muted hover:text-foreground"
          }`}
        >
          Mainnet
          <span className="rounded bg-border-strong px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-2">soon</span>
        </button>
      </div>

      <MenuItem icon={theme === "dark" ? Sun : Moon} label={theme === "dark" ? "Light mode" : "Dark mode"} onClick={toggleTheme} />
      <MenuItem icon={User} label="Profile" highlight />
      <MenuItem icon={Settings} label="Settings" />
      <MenuItem icon={signedIn ? LogOut : LogIn} label={signedIn ? "Sign out" : "Sign in"} onClick={onAuth} />
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
