"use client";

import { useEffect } from "react";

// Wallet browser-extensions (MetaMask, Phantom, etc.) race to inject
// `window.ethereum`; when two collide they throw "Cannot redefine property:
// ethereum" from inside the extension, which has nothing to do with Mirrl but
// trips Next's dev error overlay. Swallow errors that originate from an
// extension or are this specific injection clash so they don't crash the app.
export function ExtensionErrorGuard() {
  useEffect(() => {
    const fromExtension = (msg?: string, src?: string, stack?: string) =>
      (src && src.startsWith("chrome-extension://")) ||
      (stack && stack.includes("chrome-extension://")) ||
      (!!msg && /redefine property: ethereum|already been defined|Cannot set property ethereum/i.test(msg));

    const onError = (e: ErrorEvent) => {
      if (fromExtension(e.message, e.filename, e.error?.stack)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { message?: string; stack?: string } | undefined;
      if (fromExtension(reason?.message, undefined, reason?.stack)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection, true);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection, true);
    };
  }, []);

  return null;
}
