"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

export type Memory = {
  id: string;
  text: string;
  tag: string;
  createdAt: number;
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

type Store = {
  ready: boolean;
  theme: Theme;
  toggleTheme: () => void;
  network: Network;
  setNetwork: (n: Network) => void;
  signedIn: boolean;
  toggleAuth: () => void;
  model: string;
  setModel: (m: string) => void;
  memories: Memory[];
  addMemory: (text: string, tag?: string) => void;
  removeMemory: (id: string) => void;
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
  const [model, setModelState] = useState("");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // refs mirror state so session writes are synchronous (no stale closures)
  const sessionsRef = useRef<ChatSession[]>([]);
  const activeIdRef = useRef<string | null>(null);

  // hydrate everything from the database
  useEffect(() => {
    (async () => {
      try {
        const [pr, mr, sr] = await Promise.all([
          fetch("/api/prefs").then((r) => r.json()),
          fetch("/api/memories").then((r) => r.json()),
          fetch("/api/sessions").then((r) => r.json()),
        ]);
        const p = pr?.prefs;
        if (p) {
          setTheme(p.theme);
          setNetwork(p.network);
          setSignedIn(p.signedIn);
          setModelState(p.model);
          activeIdRef.current = p.activeSession ?? null;
          setActiveId(p.activeSession ?? null);
        }
        const ms: Memory[] = mr?.memories ?? [];
        setMemories(ms);
        const ss: ChatSession[] = sr?.sessions ?? [];
        sessionsRef.current = ss;
        setSessions(ss);
      } catch {
        // offline / first-run: start empty
      } finally {
        setReady(true);
      }
    })();
  }, []);

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

  const toggleAuth = useCallback(() => {
    setSignedIn((v) => {
      const next = !v;
      savePrefs({ signedIn: next });
      return next;
    });
  }, [savePrefs]);

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
        ready, theme, toggleTheme, network, setNetwork: setNetworkPersist, signedIn, toggleAuth,
        model, setModel, memories, addMemory, removeMemory,
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
