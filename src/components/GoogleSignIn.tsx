"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useAuth } from "@/lib/auth";
import { useMirrl } from "@/lib/store";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "small" | "medium" | "large";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
            },
          ) => void;
        };
      };
    };
  }
}

export function GoogleSignIn({ onSuccess }: { onSuccess?: () => void }) {
  const { signInWithGoogle } = useAuth();
  const { openClaim } = useMirrl();
  const [ready, setReady] = useState(false);
  const [signing, setSigning] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ready || !ref.current || !CLIENT_ID || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: async (response) => {
        setSigning(true);
        try {
          await signInWithGoogle(response.credential);
          onSuccess?.();
          openClaim(); // offer free test 0G (self-dismisses if already claimed)
        } catch {
          // surfaced via the menu state; keep silent here
        } finally {
          setSigning(false);
        }
      },
    });
    window.google.accounts.id.renderButton(ref.current, {
      type: "standard",
      theme: "filled_black",
      size: "medium",
      text: "continue_with",
      shape: "pill",
      width: 220,
    });
  }, [ready, signInWithGoogle, onSuccess, openClaim]);

  if (!CLIENT_ID) {
    return (
      <p className="px-2 py-1 text-[10px] italic text-muted-2">
        Google sign-in unavailable — set NEXT_PUBLIC_GOOGLE_CLIENT_ID
      </p>
    );
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setReady(true)} />
      <div ref={ref} className={signing ? "pointer-events-none opacity-50" : ""} />
    </>
  );
}
