"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useMirrl } from "@/lib/store";

// Mirrors the signed-in Google user's custodial 0G wallet into the store.
// Google is the only sign-in; no external wallet connect.
export function IdentitySync() {
  const { user } = useAuth();
  const { setWallet } = useMirrl();

  useEffect(() => {
    setWallet(user?.address ?? null);
  }, [user?.address, setWallet]);

  return null;
}
