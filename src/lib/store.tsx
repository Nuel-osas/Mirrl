"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

export type Memory = {
  id: string;
  text: string;
  tag: string;
  createdAt: number;
  strength?: number; // 0..1 elastic-brain strength
  verified?: boolean;
};

export type ChatMsg = { role: "user" | "assistant"; content: string; meta?: string };

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMsg[];
  updatedAt: number;
};

type Network = "testnet" | "mainnet";
type Theme = "dark" | "light";
export type MemoryCommit = {
  committed?: boolean;
  rootHash?: string;
  version?: number;
  count?: number;
  live?: boolean;
  registered?: boolean;
  note?: string;
};

type Store = {
  ready: boolean;
  theme: Theme;
  toggleTheme: () => void;
  network: Network;
  setNetwork: (n: Network) => void;
  signedIn: boolean;
  address: string | null;
  setWallet: (addr: string | null) => void;
  // sign-in gating
  signInOpen: boolean;
  openSignIn: () => void;
  closeSignIn: () => void;
  requireAuth: () => boolean;
  // post-sign-in faucet prompt
  claimOpen: boolean;
  openClaim: () => void;
  closeClaim: () => void;
  // profile / funding panel
  profileOpen: boolean;
  openProfile: () => void;
  closeProfile: () => void;
  model: string;
  setModel: (m: string) => void;
  memories: Memory[];
  addMemory: (text: string, tag?: string) => void;
  removeMemory: (id: string) => void;
  reloadMemories: () => Promise<void>;
  commitMemory: () => Promise<MemoryCommit | null>;
  sessions: ChatSession[];
  activeId: string | null;
  newChat: () => void;
  openChat: (id: string) => ChatSession | undefined;
  saveChat: (messages: ChatMsg[]) => void;
  deleteChat: (id: string) => void;
};

const Ctx = createContext<Store | null>(null);

const uuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Math.floor(performance.now())}-${Math.floor(performance.now() * 7)}`;

function titleFrom(messages: ChatMsg[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New chat";
  const t = first.content.trim().replace(/\s+/g, " ");
  return t.length > 38 ? t.slice(0, 38) + "…" : t || "New chat";
}

// fire-and-forget JSON request
function send(url: string, method: string, body?: unknown) {
  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => {});
}

export function MirrlProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [network, setNetwork] = useState<Network>("mainnet");
  const [signedIn, setSignedIn] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [model, setModelState] = useState("");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // refs mirror state so session writes are synchronous (no stale closures)
  const sessionsRef = useRef<ChatSession[]>([]);
  const activeIdRef = useRef<string | null>(null);

  // On mount, load only UI prefs (theme/network/model). The actual user data
  // (memories, sessions) is loaded when signed in and cleared when signed out —
  // so signing out returns to a clean anon page. Sign-in state itself comes from
  // the connected wallet / Google via <IdentitySync/>, not from prefs.
  useEffect(() => {
    (async () => {
      try {
        const p = (await fetch("/api/prefs").then((r) => r.json()))?.prefs;
        if (p) {
          setTheme(p.theme);
          setNetwork(p.network);
          setModelState(p.model);
        }
      } catch {
        // offline / first-run: defaults
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Load the user's memories + sessions; called on sign-in.
  const loadUserData = useCallback(async () => {
    try {
      const [mr, sr, pr] = await Promise.all([
        fetch("/api/memories").then((r) => r.json()),
        fetch("/api/sessions").then((r) => r.json()),
        fetch("/api/prefs").then((r) => r.json()),
      ]);
      setMemories(mr?.memories ?? []);
      const ss: ChatSession[] = sr?.sessions ?? [];
      sessionsRef.current = ss;
      setSessions(ss);
      const active = pr?.prefs?.activeSession ?? null;
      activeIdRef.current = active;
      setActiveId(active);
    } catch {}
  }, []);

  // Tie data visibility to auth: load on sign-in, wipe on sign-out.
  useEffect(() => {
    if (signedIn) {
      loadUserData();
    } else {
      setMemories([]);
      setSessions([]);
      sessionsRef.current = [];
      setActiveId(null);
      activeIdRef.current = null;
      setClaimOpen(false);
      setProfileOpen(false);
    }
  }, [signedIn, loadUserData]);

  // apply theme to the document
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  const savePrefs = useCallback((patch: Record<string, unknown>) => send("/api/prefs", "PUT", patch), []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      savePrefs({ theme: next });
      return next;
    });
  }, [savePrefs]);

  const setNetworkPersist = useCallback(
    (n: Network) => {
      setNetwork(n);
      savePrefs({ network: n });
    },
    [savePrefs],
  );

  const setModel = useCallback(
    (m: string) => {
      setModelState(m);
      if (m) savePrefs({ model: m });
    },
    [savePrefs],
  );

  // Driven by the signed-in Google user's custodial wallet via <IdentitySync/>.
  const setWallet = useCallback(
    (addr: string | null) => {
      setAddress(addr);
      setSignedIn((prev) => {
        const next = !!addr;
        if (next !== prev) savePrefs({ signedIn: next });
        return next;
      });
    },
    [savePrefs],
  );

  // ----- sign-in gate -----
  const openSignIn = useCallback(() => setSignInOpen(true), []);
  const closeSignIn = useCallback(() => setSignInOpen(false), []);
  const requireAuth = useCallback(() => {
    if (signedIn) return true;
    setSignInOpen(true);
    return false;
  }, [signedIn]);

  const openClaim = useCallback(() => setClaimOpen(true), []);
  const closeClaim = useCallback(() => setClaimOpen(false), []);
  const openProfile = useCallback(() => setProfileOpen(true), []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);

  // auto-dismiss the prompt the moment the user signs in
  useEffect(() => {
    if (signedIn) setSignInOpen(false);
  }, [signedIn]);

  // ----- memories -----
  const addMemory = useCallback((text: string, tag = "everything") => {
    const t = text.trim();
    if (!t) return;
    const mem: Memory = { id: uuid(), text: t, tag, createdAt: performance.timeOrigin + performance.now() };
    setMemories((prev) => [mem, ...prev]);
    send("/api/memories", "POST", { id: mem.id, text: t, tag });
  }, []);

  const removeMemory = useCallback((id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    send(`/api/memories?id=${encodeURIComponent(id)}`, "DELETE");
  }, []);

  const reloadMemories = useCallback(async () => {
    try {
      const d = await fetch("/api/memories").then((r) => r.json());
      setMemories(d.memories ?? []);
    } catch {}
  }, []);

  // Seal the working cache to 0G Storage, then refresh (the cache is now cleared).
  const commitMemory = useCallback(async (): Promise<MemoryCommit | null> => {
    if (!signedIn) return null;
    try {
      const res = await fetch("/api/memory/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network }),
      });
      const commit = (await res.json()) as MemoryCommit;
      const r = await fetch("/api/memories");
      const d = await r.json();
      setMemories(d.memories ?? []);
      return commit;
    } catch {
      return null;
    }
  }, [signedIn, network]);

  // ----- chat sessions -----
  const commitSessions = useCallback((next: ChatSession[]) => {
    sessionsRef.current = next;
    setSessions(next);
  }, []);

  const newChat = useCallback(() => {
    activeIdRef.current = null;
    setActiveId(null);
    savePrefs({ activeSession: null });
  }, [savePrefs]);

  const openChat = useCallback(
    (id: string) => {
      activeIdRef.current = id;
      setActiveId(id);
      savePrefs({ activeSession: id });
      return sessionsRef.current.find((s) => s.id === id);
    },
    [savePrefs],
  );

  const saveChat = useCallback(
    (messages: ChatMsg[]) => {
      if (messages.length === 0) return;
      let id = activeIdRef.current;
      const isNew = !id;
      if (!id) {
        id = uuid();
        activeIdRef.current = id;
        setActiveId(id);
      }
      const prev = sessionsRef.current;
      const title = titleFrom(messages);
      const updated: ChatSession = { id, title, messages, updatedAt: performance.now() };
      commitSessions([updated, ...prev.filter((s) => s.id !== id)]);
      send("/api/sessions", "POST", { id, title, messages });
      if (isNew) savePrefs({ activeSession: id });
    },
    [commitSessions, savePrefs],
  );

  const deleteChat = useCallback(
    (id: string) => {
      commitSessions(sessionsRef.current.filter((s) => s.id !== id));
      send(`/api/sessions?id=${encodeURIComponent(id)}`, "DELETE");
      if (activeIdRef.current === id) {
        activeIdRef.current = null;
        setActiveId(null);
        savePrefs({ activeSession: null });
      }
    },
    [commitSessions, savePrefs],
  );

  return (
    <Ctx.Provider
      value={{
        ready, theme, toggleTheme, network, setNetwork: setNetworkPersist, signedIn, address, setWallet,
        signInOpen, openSignIn, closeSignIn, requireAuth,
        claimOpen, openClaim, closeClaim,
        profileOpen, openProfile, closeProfile,
        model, setModel, memories, addMemory, removeMemory, reloadMemories, commitMemory,
        sessions, activeId, newChat, openChat, saveChat, deleteChat,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useMirrl() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMirrl must be used within MirrlProvider");
  return c;
}
