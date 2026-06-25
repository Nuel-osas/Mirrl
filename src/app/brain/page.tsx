"use client";

import { useState } from "react";
import {
  Maximize,
  Crosshair,
  Plus,
  Minus,
  Search,
  RefreshCw,
  Map,
  Download,
  ListOrdered,
} from "lucide-react";
import { useMirrl } from "@/lib/store";
import { MirrlLogo } from "@/components/MirrlLogo";

export default function BrainPage() {
  const { memories } = useMirrl();
  const [zoom, setZoom] = useState(1);

  const count = memories.length;
  const radius = count > 8 ? 240 : 200;

  const nodes = memories.map((m, i) => {
    const angle = i * ((2 * Math.PI) / Math.max(count, 1)) - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    return { ...m, x, y };
  });

  const tools = [
    { icon: Maximize, label: "Fullscreen" },
    { icon: Crosshair, label: "Recenter", onClick: () => setZoom(1) },
    { icon: Plus, label: "Zoom in", onClick: () => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2))) },
    { icon: Minus, label: "Zoom out", onClick: () => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2))) },
    { icon: Search, label: "Search" },
    { icon: RefreshCw, label: "Refresh" },
    { icon: Map, label: "Map" },
    { icon: Download, label: "Export" },
    { icon: ListOrdered, label: "List" },
  ];

  return (
    <main
      className="relative flex-1 overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      {/* Scalable canvas */}
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{ transform: `scale(${zoom})` }}
      >
        {/* Connector lines */}
        {count > 0 && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            {nodes.map((n) => (
              <line
                key={`line-${n.id}`}
                x1="50%"
                y1="50%"
                x2={`calc(50% + ${n.x}px)`}
                y2={`calc(50% + ${n.y}px)`}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
              />
            ))}
          </svg>
        )}

        {/* Centered memory node */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          {/* Glow */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/20 blur-3xl" />
          <div className="relative flex flex-col items-center gap-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border-strong bg-surface text-foreground brand-grad">
              <MirrlLogo size={28} />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted">your memory</p>
              <p className="text-xs text-muted-2">{count} memories</p>
            </div>
          </div>
        </div>

        {/* Memory nodes */}
        {nodes.map((n) => (
          <div
            key={n.id}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `calc(50% + ${n.x}px)`,
              top: `calc(50% + ${n.y}px)`,
            }}
          >
            <div className="max-w-[140px] truncate rounded-xl border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground">
              {n.text}
            </div>
          </div>
        ))}
      </div>

      {/* Tool rail */}
      <div className="absolute right-4 top-1/2 z-20 -translate-y-1/2">
        <div className="flex flex-col gap-0.5 rounded-2xl border border-border bg-surface/70 p-1.5 backdrop-blur">
          {tools.map((t, i) => {
            const Icon = t.icon;
            return (
              <div key={t.label}>
                <button
                  type="button"
                  aria-label={t.label}
                  onClick={t.onClick}
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <Icon size={16} />
                </button>
                {/* Zoom % between Plus and Minus */}
                {i === 2 && (
                  <p className="py-0.5 text-center text-[10px] text-muted-2">
                    {Math.round(zoom * 100)}%
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
