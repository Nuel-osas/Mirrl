"use client";

import { usePathname } from "next/navigation";
import { BookText } from "lucide-react";
import { TopNav } from "@/components/TopNav";

// The app chrome (TopNav + Docs button) wraps every page — except standalone
// marketing routes like /demo, which render full-bleed with their own layout.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname?.startsWith("/demo");

  if (bare) {
    return <div className="h-screen overflow-y-auto bg-background text-foreground">{children}</div>;
  }

  return (
    <>
      <div className="flex h-screen flex-col bg-background text-foreground">
        <TopNav />
        <div className="relative flex flex-1 overflow-hidden [&>*]:min-w-0 [&>*]:flex-1">{children}</div>
      </div>
      <a
        href="https://docs.0g.ai"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-4 z-40 hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-surface/80 px-3 py-2 text-xs text-muted backdrop-blur hover:text-foreground transition-colors"
      >
        <BookText size={14} /> Docs
      </a>
    </>
  );
}
