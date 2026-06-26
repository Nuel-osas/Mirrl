"use client";

import { useRef, useState } from "react";
import { X, FileText, StickyNote, Sparkles, Loader2, Plus, Trash2 } from "lucide-react";
import { useMirrl } from "@/lib/store";

type Mode = "note" | "file";

export function AddMemoryModal({ onClose }: { onClose: () => void }) {
  const { addMemory } = useMirrl();
  const [mode, setMode] = useState<Mode>("note");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [facts, setFacts] = useState<string[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setFileName(file.name);
    setText(await file.text());
  }

  async function distill() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body, title: fileName || undefined }),
      });
      const d = await res.json();
      setFacts(d.facts?.length ? d.facts : [body]);
    } catch {
      setFacts([body]);
    } finally {
      setBusy(false);
    }
  }

  function save() {
    (facts ?? []).forEach((f) => addMemory(f, mode === "file" ? "document" : "note"));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-24 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border-strong bg-surface shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Add memory</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:text-foreground hover:bg-surface-2">
            <X size={16} />
          </button>
        </div>

        {!facts ? (
          <div className="p-4">
            <div className="mb-3 flex rounded-lg bg-surface-2 p-0.5">
              <Tab active={mode === "note"} onClick={() => setMode("note")} icon={StickyNote} label="Note" />
              <Tab active={mode === "file"} onClick={() => setMode("file")} icon={FileText} label="File" />
            </div>

            {mode === "note" ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write anything — facts, preferences, context. Mirrl distills it into clean memories."
                className="h-40 w-full resize-none rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-2 outline-none focus:border-border-strong"
              />
            ) : (
              <div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/50 text-sm text-muted hover:border-border-strong"
                >
                  <FileText size={20} />
                  {fileName ? fileName : "Choose a .txt or .md file"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.md,.markdown,text/plain"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                />
                {text && <p className="mt-2 line-clamp-3 text-xs text-muted-2">{text.slice(0, 240)}…</p>}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-foreground">
                Cancel
              </button>
              <button
                onClick={distill}
                disabled={!text.trim() || busy}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Distill
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <p className="mb-2 text-xs text-muted-2">
              {facts.length} {facts.length === 1 ? "memory" : "memories"} distilled — review and edit, then save.
            </p>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {facts.map((f, i) => (
                <div key={i} className="group flex items-start gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm">
                  <span className="mt-0.5 text-muted-2">{i + 1}</span>
                  <input
                    value={f}
                    onChange={(e) => setFacts((prev) => prev!.map((x, j) => (j === i ? e.target.value : x)))}
                    className="flex-1 bg-transparent text-foreground outline-none"
                  />
                  <button
                    onClick={() => setFacts((prev) => prev!.filter((_, j) => j !== i))}
                    className="opacity-0 group-hover:opacity-100 text-muted-2 hover:text-foreground"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button onClick={() => setFacts(null)} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-foreground">
                Back
              </button>
              <button
                onClick={save}
                disabled={facts.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40"
              >
                <Plus size={14} /> Save {facts.length} {facts.length === 1 ? "memory" : "memories"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Tab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof FileText; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-background text-foreground shadow" : "text-muted hover:text-foreground"
      }`}
    >
      <Icon size={13} /> {label}
    </button>
  );
}
