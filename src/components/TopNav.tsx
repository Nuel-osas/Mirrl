"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Home, Layers, Brain, Users, BookOpen, Sparkles, LayoutGrid,
  MessageSquare, Plus, Bell,
} from "lucide-react";
import { MirrlLogo } from "@/components/MirrlLogo";
import { AccountMenu } from "@/components/AccountMenu";
import { useMirrl } from "@/lib/store";

const NAV = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Layers, label: "Memories", href: "/memories" },
  { icon: Brain, label: "Brain", href: "/brain" },
  { icon: Users, label: "Agents", href: "/agents" },
  { icon: BookOpen, label: "Knowledge", href: "/knowledge" },
  { icon: Sparkles, label: "Studio", href: "/studio" },
  { icon: LayoutGrid, label: "Integrations", href: "/integrations" },
];

export function TopNav() {
  const pathname = usePathname();
  const { theme, toggleTheme, network, setNetwork, signedIn, toggleAuth } = useMirrl();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <header className="flex items-center justify-between px-5 py-3.5">
      <Link href="/" className="flex items-center gap-2.5">
        <MirrlLogo size={24} />
        <span className="text-lg font-semibold tracking-tight">Mirrl</span>
      </Link>

      <nav className="hidden md:flex items-center gap-1 rounded-xl border border-border bg-surface/60 p-1">
        {NAV.map(({ icon: Icon, label, href }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                active ? "bg-foreground text-background" : "text-muted hover:text-foreground hover:bg-surface-2"
              }`}
            >
              <Icon size={15} />
              <span className={label === "Home" ? "hidden" : "hidden lg:inline"}>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <button className="rounded-lg border border-border bg-surface/60 p-2 text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
          <MessageSquare size={16} />
        </button>
        <Link
          href="/memories"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm text-foreground hover:bg-surface-2 transition-colors"
        >
          <Plus size={15} /> <span className="hidden sm:inline">Add memory</span>
        </Link>
        <button className="rounded-lg p-2 text-muted hover:text-foreground transition-colors">
          <Bell size={16} />
        </button>
        <div className="relative" ref={accountRef}>
          <button
            onClick={() => setAccountOpen((o) => !o)}
            className="h-9 w-9 rounded-full brand-grad ring-2 ring-transparent hover:ring-border-strong transition"
            aria-label="Account"
          />
          {accountOpen && (
            <AccountMenu
              network={network}
              setNetwork={setNetwork}
              theme={theme}
              toggleTheme={toggleTheme}
              signedIn={signedIn}
              onAuth={() => {
                toggleAuth();
                setAccountOpen(false);
              }}
            />
          )}
        </div>
      </div>
    </header>
  );
}
