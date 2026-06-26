"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, ShieldCheck, Image as ImageIcon, MessageSquare, AudioLines, Crown } from "lucide-react";
import { bestAvailable, type OgModel } from "@/lib/og";
import { useMirrl } from "@/lib/store";

const typeIcon = { chatbot: MessageSquare, image: ImageIcon, speech: AudioLines } as const;

export function ModelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: OgModel) => void;
}) {
  const { network } = useMirrl();
  const [models, setModels] = useState<OgModel[]>([]);
  const [funded, setFunded] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/models?network=${network}`).then((r) => r.json()),
      fetch(`/api/models/funded?network=${network}`).then((r) => r.json()).catch(() => ({ funded: [] })),
    ])
      .then(([d, f]: [{ source: string; models: OgModel[] }, { funded: string[] }]) => {
        if (cancelled) return;
        const list = d.models || [];
        const fundedSet = new Set(f.funded || []);
        setModels(list);
        setSource(d.source);
        setFunded(fundedSet);
        // default selection: prefer a funded ("ready") model, else best available
        const has = list.some((m) => m.model === value);
        if (list.length && !has) {
          const ready = list.find((m) => fundedSet.has(m.model))?.model;
          const pick = list.find((m) => m.model === (ready ?? bestAvailable(list)));
          if (pick) onChange(pick);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = models.find((m) => m.model === value);
  const featured = models.filter((m) => m.rank != null);
  const others = models.filter((m) => m.rank == null);

  const row = (m: OgModel) => {
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
        {m.rank != null ? (
          <Crown size={14} className="shrink-0 text-amber-400/90" />
        ) : (
          <Icon size={15} className="shrink-0 text-muted" />
        )}
        <span className="flex-1 min-w-0">
          <span className="block truncate text-[13px] text-foreground">{m.label}</span>
          <span className="block truncate text-[10px] text-muted-2">
            {funded.has(m.model) ? "ready" : m.note ?? m.model}
          </span>
        </span>
        {funded.has(m.model) ? (
          <span className="shrink-0 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">ready</span>
        ) : (
          <span
            className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium text-muted-2"
            title="Not funded yet — using this enables it with ~1 0G from your wallet (one-time)"
          >
            ~1 0G
          </span>
        )}
        {m.model === value && <Check size={14} className="shrink-0 text-foreground" />}
      </button>
    );
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
        <span className="max-w-[140px] truncate sm:max-w-[150px]">{current?.label ?? value ?? "Select model"}</span>
        <ChevronDown size={13} className="shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-border-strong bg-surface p-1.5 shadow-2xl shadow-black/50 sm:left-auto sm:right-0 sm:w-72">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-2">
              0G Compute · {network}
            </span>
            <span className="text-[10px] text-muted-2">{source === "live" ? "live" : "catalog"}</span>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {featured.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 px-2 pt-1 pb-1 text-[10px] font-medium uppercase tracking-wider text-amber-400/80">
                  <Crown size={11} /> Top models
                </div>
                {featured.map(row)}
              </>
            )}
            {others.length > 0 && (
              <>
                <div className="px-2 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-2">
                  All models
                </div>
                {others.map(row)}
              </>
            )}
            {models.length === 0 && (
              <div className="px-2 py-4 text-center text-xs text-muted-2">Loading 0G models…</div>
            )}
          </div>

          <div className="border-t border-border mt-1 px-2 py-1.5 text-[10px] leading-relaxed text-muted-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={11} className="text-emerald-400/80" /> TEE-verifiable · runs on 0G
            </span>
            <span className="mt-0.5 block">
              <span className="text-emerald-400">ready</span> = funded · others use ~1 0G on first run. Reclaim anytime in Wallet.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
