"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Home, Layers, Brain, Users, BookOpen, Sparkles, LayoutGrid,
  MessageSquare, Plus, Bell, Menu, X, Sun, Moon,
} from "lucide-react";
import { MirrlLogo } from "@/components/MirrlLogo";
import { AccountMenu } from "@/components/AccountMenu";
import { AddMemoryModal } from "@/components/AddMemoryModal";
import { useMirrl } from "@/lib/store";

const NAV = [
  { icon: Home, label: "Home", href: "/", soon: false },
  { icon: Layers, label: "Memories", href: "/memories", soon: true },
  { icon: Brain, label: "Brain", href: "/brain", soon: true },
  { icon: Users, label: "Agents", href: "/agents", soon: true },
  { icon: BookOpen, label: "Knowledge", href: "/knowledge", soon: true },
  { icon: Sparkles, label: "Studio", href: "/studio", soon: true },
  { icon: LayoutGrid, label: "Integrations", href: "/integrations", soon: false },
];

export function TopNav() {
  const pathname = usePathname();
  const { theme, toggleTheme, network, setNetwork, requireAuth } = useMirrl();
  const [accountOpen, setAccountOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // close the mobile drawer on navigation
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <header className="flex items-center justify-between px-5 py-3.5">
      <Link href="/" className="flex items-center gap-2.5">
        <MirrlLogo size={24} />
        <span className="text-lg font-semibold tracking-tight">Mirrl</span>
      </Link>

      <nav className="hidden md:flex items-center gap-1 rounded-xl border border-border bg-surface/60 p-1">
        {NAV.map(({ icon: Icon, label, href, soon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

          if (soon) {
            return (
              <div key={label} className="group relative">
                <button
                  type="button"
                  aria-disabled
                  className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-2/70 transition-colors hover:text-muted"
                >
                  <Icon size={15} />
                  <span className="hidden lg:inline">{label}</span>
                </button>
                <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-brand-to/50 bg-surface px-2 py-1 text-[10px] font-medium tracking-wide text-foreground opacity-0 shadow-[0_0_20px_rgba(124,92,255,0.55)] transition-opacity duration-200 group-hover:opacity-100">
                  Coming soon
                </span>
              </div>
            );
          }

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
        <button className="hidden sm:flex rounded-lg border border-border bg-surface/60 p-2 text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
          <MessageSquare size={16} />
        </button>
        <button
          onClick={() => requireAuth() && setAddOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm text-foreground hover:bg-surface-2 transition-colors"
        >
          <Plus size={15} /> <span className="hidden sm:inline">Add memory</span>
        </button>
        <button className="hidden sm:flex rounded-lg p-2 text-muted hover:text-foreground transition-colors">
          <Bell size={16} />
        </button>
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          className="md:hidden rounded-lg border border-border bg-surface/60 p-2 text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
        >
          <Menu size={16} />
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
            />
          )}
        </div>
      </div>

      {/* mobile nav: scrim + slide-in drawer */}
      <div
        className={`fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm transition-opacity md:hidden ${
          navOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setNavOpen(false)}
        aria-hidden
      />
      <aside
        className={`fixed left-0 top-0 z-[56] flex h-full w-72 flex-col border-r border-border-strong bg-surface p-4 transition-transform duration-200 md:hidden ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!navOpen}
      >
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <MirrlLogo size={22} />
            <span className="text-lg font-semibold tracking-tight">Mirrl</span>
          </Link>
          <button onClick={() => setNavOpen(false)} aria-label="Close menu" className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <nav className="mt-5 space-y-1">
          {NAV.map(({ icon: Icon, label, href, soon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            if (soon) {
              return (
                <div key={label} className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-muted-2/70">
                  <span className="flex items-center gap-3">
                    <Icon size={16} /> {label}
                  </span>
                  <span className="rounded border border-brand-to/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-2">Soon</span>
                </div>
              );
            }
            return (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active ? "bg-foreground text-background" : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <Icon size={16} /> {label}
              </Link>
            );
          })}
        </nav>

        <div className="my-4 border-t border-border" />

        <button
          onClick={() => {
            setNavOpen(false);
            if (requireAuth()) setAddOpen(true);
          }}
          className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm text-foreground hover:bg-surface-2"
        >
          <Plus size={16} /> Add memory
        </button>
        <button
          onClick={toggleTheme}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </aside>

      {addOpen && <AddMemoryModal onClose={() => setAddOpen(false)} />}
    </header>
  );
}
