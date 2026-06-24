"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, ShieldCheck, Image as ImageIcon, MessageSquare, AudioLines } from "lucide-react";
import type { OgModel } from "@/lib/og";

const typeIcon = { chatbot: MessageSquare, image: ImageIcon, speech: AudioLines } as const;

export function ModelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: OgModel) => void;
}) {
  const [models, setModels] = useState<OgModel[]>([]);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d: { source: string; models: OgModel[] }) => {
        setModels(d.models || []);
        setSource(d.source);
        if (d.models?.length && !value) onChange(d.models[0]);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = models.find((m) => m.model === value);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="max-w-[140px] truncate">{current?.label ?? value ?? "Select model"}</span>
        <ChevronDown size={13} className="opacity-60" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-72 rounded-xl border border-border-strong bg-surface p-1.5 shadow-2xl shadow-black/50 z-50">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-2">0G Compute models</span>
            <span className="text-[10px] text-muted-2">{source === "live" ? "live" : "catalog"}</span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {models.map((m) => {
              const Icon = typeIcon[m.type];
              return (
                <button
                  key={`${m.provider}-${m.model}`}
                  onClick={() => {
                    onChange(m);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-surface-2 transition-colors"
                >
                  <Icon size={15} className="shrink-0 text-muted" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-[13px] text-foreground">{m.label}</span>
                    <span className="block truncate text-[10px] text-muted-2">{m.model}</span>
                  </span>
                  {m.verifiable && <ShieldCheck size={13} className="shrink-0 text-emerald-400/80" />}
                  {m.model === value && <Check size={14} className="shrink-0 text-foreground" />}
                </button>
              );
            })}
            {models.length === 0 && (
              <div className="px-2 py-4 text-center text-xs text-muted-2">Loading 0G models…</div>
            )}
          </div>
          <div className="border-t border-border mt-1 px-2 py-1.5 text-[10px] text-muted-2 flex items-center gap-1.5">
            <ShieldCheck size={11} className="text-emerald-400/80" /> TEE-verifiable inference · runs on 0G
          </div>
        </div>
      )}
    </div>
  );
}
