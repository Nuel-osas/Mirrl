"use client";

import { useEffect, useRef, useState } from "react";
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide, type Simulation } from "d3-force";
import { Plus, Minus, Crosshair, Trash2, X, ShieldCheck } from "lucide-react";
import { useMirrl } from "@/lib/store";
import { useMemoryStatus, SignInGate } from "@/components/MemoryStatus";
import { MirrlLogo } from "@/components/MirrlLogo";

type GNode = {
  id: string; text: string; tag: string; strength?: number; verified?: boolean;
  x?: number; y?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null;
};
type SimLink = { source: string; target: string; sim: number };

export default function BrainPage() {
  const { memories, signedIn, removeMemory } = useMirrl();
  const { status } = useMemoryStatus();
  const [rawLinks, setRawLinks] = useState<{ a: string; b: string; sim: number }[]>([]);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Simulation<GNode, SimLink> | null>(null);
  const nodesRef = useRef<GNode[]>([]);
  const drag = useRef<{ node: GNode | null; pan: boolean; sx: number; sy: number; ox: number; oy: number }>({ node: null, pan: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const [size, setSize] = useState({ w: 900, h: 700 });
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [selected, setSelected] = useState<GNode | null>(null);

  useEffect(() => {
    if (!signedIn) { setRawLinks([]); return; }
    fetch("/api/memory/links").then((r) => r.json()).then((d) => setRawLinks(d.links ?? [])).catch(() => {});
  }, [signedIn, memories.length]);

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  // build / update the force simulation, preserving positions of existing nodes
  useEffect(() => {
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    const nodes: GNode[] = memories.map((m) =>
      Object.assign(prev.get(m.id) ?? { id: m.id }, { text: m.text, tag: m.tag, strength: m.strength, verified: m.verified }),
    );
    nodesRef.current = nodes;
    const links: SimLink[] = rawLinks.map((l) => ({ source: l.a, target: l.b, sim: l.sim }));

    simRef.current?.stop();
    const sim = forceSimulation<GNode>(nodes)
      .force("charge", forceManyBody().strength(-340))
      .force("link", forceLink<GNode, SimLink>(links).id((d) => d.id).distance((d) => 150 - 80 * d.sim).strength((d) => 0.2 + 0.6 * d.sim))
      .force("center", forceCenter(0, 0).strength(0.045))
      .force("collide", forceCollide(54))
      .alpha(0.9).restart()
      .on("tick", rerender);
    simRef.current = sim;
    return () => { sim.stop(); };
  }, [memories, rawLinks]);

  if (!signedIn) {
    return <SignInGate title="Your brain, visualized" subtitle="Sign in to explore your memory as a living, connected graph — owned by you on 0G." />;
  }

  const cx = size.w / 2 + view.x;
  const cy = size.h / 2 + view.y;
  const nodes = nodesRef.current;
  const byId = (id: string) => nodes.find((n) => n.id === id);
  const toSim = (clientX: number, clientY: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left - cx) / view.k, y: (clientY - r.top - cy) / view.k };
  };

  const nodeDown = (e: React.PointerEvent, n: GNode) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current.node = n;
    simRef.current?.alphaTarget(0.3).restart();
    const p = toSim(e.clientX, e.clientY);
    n.fx = p.x; n.fy = p.y;
  };
  const bgDown = (e: React.PointerEvent) => {
    drag.current = { ...drag.current, pan: true, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d.node) { const p = toSim(e.clientX, e.clientY); d.node.fx = p.x; d.node.fy = p.y; }
    else if (d.pan) setView((v) => ({ ...v, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }));
  };
  const up = () => {
    if (drag.current.node) { drag.current.node.fx = null; drag.current.node.fy = null; simRef.current?.alphaTarget(0); }
    drag.current.node = null; drag.current.pan = false;
  };
  const zoom = (f: number) => setView((v) => ({ ...v, k: Math.min(2.2, Math.max(0.4, +(v.k * f).toFixed(2))) }));

  return (
    <main
      ref={wrapRef}
      className="relative flex-1 touch-none select-none overflow-hidden bg-black"
      style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "24px 24px", cursor: drag.current.pan ? "grabbing" : "default" }}
      onPointerDown={bgDown}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={up}
      onWheel={(e) => zoom(e.deltaY < 0 ? 1.1 : 0.9)}
    >
      {/* 0G ownership overlay */}
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-border bg-surface/70 px-3 py-2 text-xs backdrop-blur">
        <span className="text-foreground"><b>{nodes.length}</b> memories</span>
        <span className="text-muted-2">·</span>
        {status && status.version > 0 ? (
          <span className="flex items-center gap-1 text-muted">committed <b className="text-foreground">v{status.version}</b> to 0G {status.live && <ShieldCheck size={12} className="text-emerald-400" />}</span>
        ) : (
          <span className="text-muted">not yet on 0G</span>
        )}
        <span className="text-muted-2">·</span>
        <span className="text-muted-2">drag to move · scroll to zoom</span>
      </div>

      {/* transformed world: links + core + nodes share one coordinate space */}
      <div className="absolute inset-0" style={{ transform: `translate(${cx}px, ${cy}px) scale(${view.k})`, transformOrigin: "0 0" }}>
        <svg className="pointer-events-none absolute overflow-visible" style={{ left: 0, top: 0, width: 1, height: 1 }}>
          {rawLinks.map((l, i) => {
            const a = byId(l.a); const b = byId(l.b);
            if (!a || a.x == null || !b || b.x == null) return null;
            return <line key={i} x1={a.x} y1={a.y!} x2={b.x} y2={b.y!} stroke={`rgba(124,92,255,${Math.min(0.75, 0.25 + l.sim)})`} strokeWidth={0.8 + l.sim * 2.2} />;
          })}
          {nodes.map((n) => n.x != null && <line key={`c-${n.id}`} x1={0} y1={0} x2={n.x} y2={n.y!} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />)}
        </svg>

        {/* central core */}
        <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: 0, top: 0 }}>
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/20 blur-3xl" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full brand-grad"><MirrlLogo size={26} /></div>
        </div>

        {/* memory nodes (draggable) */}
        {nodes.map((n) => {
          if (n.x == null) return null;
          const s = n.strength ?? 0.5;
          const durable = s >= 0.66;
          return (
            <div
              key={n.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
              style={{ left: n.x, top: n.y, opacity: 0.5 + 0.5 * s }}
              onPointerDown={(e) => nodeDown(e, n)}
              onClick={(e) => { e.stopPropagation(); setSelected(n); }}
            >
              <div className={`max-w-[130px] truncate rounded-xl border bg-surface px-2.5 py-1.5 text-xs text-foreground ${durable ? "border-[var(--brand-to,#7c5cff)]/70 shadow-[0_0_14px_-2px_var(--brand-to,#7c5cff)]" : "border-border"}`}>
                {n.verified ? "✓ " : ""}{n.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* zoom controls */}
      <div className="absolute right-4 top-1/2 z-20 -translate-y-1/2 flex flex-col gap-0.5 rounded-2xl border border-border bg-surface/70 p-1.5 backdrop-blur">
        <button onClick={() => zoom(1.15)} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-foreground"><Plus size={16} /></button>
        <p className="py-0.5 text-center text-[10px] text-muted-2">{Math.round(view.k * 100)}%</p>
        <button onClick={() => zoom(0.87)} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-foreground"><Minus size={16} /></button>
        <button onClick={() => setView({ x: 0, y: 0, k: 1 })} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-foreground"><Crosshair size={16} /></button>
      </div>

      {/* detail card */}
      {selected && (
        <div className="absolute bottom-4 left-1/2 z-30 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-border-strong bg-surface p-4 shadow-2xl">
          <button onClick={() => setSelected(null)} className="absolute right-3 top-3 text-muted-2 hover:text-foreground"><X size={16} /></button>
          <p className="pr-6 text-sm text-foreground">{selected.text}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] capitalize text-muted">{selected.tag}</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
              {(selected.strength ?? 0.5) >= 0.66 ? "durable" : (selected.strength ?? 0.5) >= 0.33 ? "active" : "faded"}
            </span>
            <button
              onClick={() => { removeMemory(selected.id); setSelected(null); }}
              className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-400/10"
            >
              <Trash2 size={13} /> Forget
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
