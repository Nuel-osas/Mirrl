"use client";

import { useRef, useState } from "react";
import { Upload, FileText, Trash2, Plus } from "lucide-react";
import { useMirrl } from "@/lib/store";

const TABS = ["All Sources", "PDFs", "Markdown", "0G Storage"] as const;
type Tab = (typeof TABS)[number];

export default function KnowledgePage() {
  const { addMemory } = useMirrl();
  const [tab, setTab] = useState<Tab>("All Sources");
  const [docs, setDocs] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function ingest(names: string[]) {
    const clean = names.filter((n) => n && n.trim().length > 0);
    if (clean.length === 0) return;
    setDocs((prev) => [...prev, ...clean]);
    clean.forEach((n) => addMemory(n, "0G Storage"));
  }

  function onFiles(list: FileList | null) {
    if (!list) return;
    ingest(Array.from(list).map((f) => f.name));
  }

  return (
    <main className="flex flex-1 flex-col overflow-y-auto px-6 py-8">
      <div className="relative flex flex-1 overflow-hidden">
        <div className="mx-auto w-full max-w-3xl">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-foreground">Knowledge</h1>
            <p className="mt-1 text-sm text-muted">
              Ingest documents into Mirrl's retrieval memory on 0G.
            </p>
          </div>

          {/* Tab chips */}
          <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
            {TABS.map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-foreground text-background"
                      : "text-muted hover:text-foreground hover:bg-surface-2"
                  }`}
                >
                  {t}
                </button>
              );
            })}
            <button
              aria-label="Add source"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Ingest dropzone */}
          <div className="mx-auto max-w-md">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                onFiles(e.dataTransfer.files);
              }}
              className={`flex flex-col items-center rounded-2xl border bg-surface p-8 text-center transition-colors ${
                dragging ? "border-border-strong" : "border-border"
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
                <Upload className="h-5 w-5 text-foreground" />
              </div>
              <p className="mt-4 font-bold text-foreground">Ingest Source</p>
              <p className="mt-1 text-sm text-muted">
                Drag &amp; drop PDFs, TXT, or MD files here
              </p>
              <button
                onClick={() => inputRef.current?.click()}
                className="mt-4 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
              >
                Browse Files
              </button>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  onFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          {/* Document list / empty state */}
          <div className="mt-8">
            {docs.length === 0 ? (
              <div className="py-8 text-center">
                <p className="font-bold text-foreground">No documents yet</p>
                <p className="mt-1 text-sm text-muted">
                  Drop a file above to get started.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {docs.map((name, i) => (
                  <li
                    key={`${name}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-2">
                      · 0G Storage
                    </span>
                    <button
                      aria-label={`Remove ${name}`}
                      onClick={() =>
                        setDocs((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
