"use client";

import { X } from "lucide-react";
import { useMirrl } from "@/lib/store";
import { MirrlLogo } from "@/components/MirrlLogo";
import { GoogleSignIn } from "@/components/GoogleSignIn";

export function SignInModal() {
  const { signInOpen, closeSignIn } = useMirrl();

  if (!signInOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={closeSignIn}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-border-strong bg-surface p-6 text-center shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeSignIn}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-2 hover:bg-surface-2 hover:text-foreground"
        >
          <X size={16} />
        </button>

        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl brand-grad">
          <MirrlLogo size={24} />
        </div>
        <h2 className="text-lg font-semibold">Start your memory</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
          Mirrl remembers you across every chat — and the memory is yours, stored on 0G.
          Sign in to begin; nobody, not even us, can read it.
        </p>

        <div className="mt-5 flex flex-col items-center gap-3">
          <GoogleSignIn onSuccess={closeSignIn} />
          <p className="text-[11px] text-muted-2">We create a private 0G wallet for you automatically.</p>
        </div>
      </div>
    </div>
  );
}
