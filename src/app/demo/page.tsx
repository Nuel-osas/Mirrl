import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Play, ShieldCheck, BrainCircuit, Database, Lock } from "lucide-react";
import { MirrlLogo } from "@/components/MirrlLogo";

export const metadata: Metadata = {
  title: "Mirrl — See it work",
  description: "The 2-minute demo: a personal AI whose memory you own, on 0G.",
};

// The Mirrl demo on YouTube (youtu.be/YyfuMyVr_Uk). Override with
// NEXT_PUBLIC_DEMO_VIDEO_ID if you re-upload.
const VIDEO_ID = process.env.NEXT_PUBLIC_DEMO_VIDEO_ID || "YyfuMyVr_Uk";
const REGISTRY = process.env.NEXT_PUBLIC_MIRRL_REGISTRY || "";

export default function DemoPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 pb-24 pt-6 sm:px-8">
      {/* header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <MirrlLogo size={20} />
          <span>Mirrl</span>
          <span className="text-muted-2">/ demo</span>
        </div>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#how" className="text-muted hover:text-foreground transition-colors">how it works</a>
          <Link href="/" className="flex items-center gap-1 text-foreground hover:opacity-80 transition-opacity">
            open the app <ArrowRight size={14} />
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="mt-16 sm:mt-24">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em]">
          <span className="grad-text">ミラー</span>
          <span className="text-muted-2">·</span>
          <span className="text-muted">Live demo</span>
        </div>

        <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
          See Mirrl <span className="grad-text italic">remember.</span>
        </h1>

        <div className="mt-5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted">
          <Play size={12} className="fill-current" /> The 2-min demo
        </div>

        {/* video */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-2xl shadow-black/40">
          <div className="relative aspect-video w-full">
            {VIDEO_ID ? (
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube.com/embed/${VIDEO_ID}`}
                title="Mirrl demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_40%,rgba(124,92,255,0.18),transparent_70%)]">
                <div className="flex h-16 w-16 items-center justify-center rounded-full brand-grad shadow-lg">
                  <Play size={26} className="fill-white text-white" />
                </div>
                <p className="text-sm text-muted">Demo video coming soon</p>
                <p className="text-[11px] text-muted-2">Set NEXT_PUBLIC_DEMO_VIDEO_ID to embed it</p>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted">
          A personal AI whose memory you actually own. Inference runs privately on{" "}
          <span className="text-foreground">0G Compute</span> inside a TEE; what it learns about you is
          distilled, <span className="text-foreground">encrypted with your own key</span>, stored on{" "}
          <span className="text-foreground">0G Storage</span>, and its ownership is recorded on{" "}
          <span className="text-foreground">0G Chain</span>. Watch it remember you — then verify the memory is yours.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg brand-grad px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            Open the app <ArrowRight size={15} />
          </Link>
          <a
            href="#how"
            className="rounded-lg border border-border-strong px-5 py-3 text-sm font-medium text-foreground transition hover:bg-surface-2"
          >
            How it works
          </a>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="mt-24 scroll-mt-8">
        <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-muted-2">The loop</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Step icon={BrainCircuit} title="It remembers, automatically" body="Just chat. Mirrl quietly extracts the durable facts about you into a private working memory — no 'save' button." />
          <Step icon={ShieldCheck} title="Private, verifiable inference" body="Every reply is generated on 0G Compute inside a TEE. The host can't read your conversation; the result is cryptographically verifiable." />
          <Step icon={Lock} title="Encrypted & owned" body="When a session ends, your memory is consolidated, encrypted with a key only your wallet holds, and uploaded to 0G Storage." />
          <Step icon={Database} title="Yours on-chain" body="A pointer to your memory blob is recorded on 0G Chain. You own it — portable, censorship-resistant, reclaimable." />
        </div>
      </section>

      {/* on-chain proof */}
      <section className="mt-16 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          <h2 className="text-sm font-semibold">Verifiable on 0G</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Not a claim — a fact. Memory ownership is enforced by the on-chain <span className="text-foreground">MirrlMemory</span> registry,
          and every memory is a content-addressed blob replicated across 0G Storage nodes.
        </p>
        {REGISTRY && (
          <a
            href={`https://chainscan.0g.ai/address/${REGISTRY}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-foreground transition hover:bg-border"
          >
            Registry {REGISTRY.slice(0, 10)}…{REGISTRY.slice(-6)} <ArrowRight size={12} />
          </a>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {["0G Compute · TEE", "0G Storage", "0G Chain"].map((t) => (
            <span key={t} className="rounded-full border border-border-strong bg-surface-2 px-3 py-1 text-[11px] text-muted">
              {t}
            </span>
          ))}
        </div>
      </section>

      <footer className="mt-16 flex items-center justify-between border-t border-border pt-6 text-xs text-muted-2">
        <span>Mirrl — the AI whose memory you own.</span>
        <span>Built for The Zero Cup · 0G</span>
      </footer>
    </main>
  );
}

function Step({ icon: Icon, title, body }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-[var(--brand-to,#7c5cff)]">
        <Icon size={18} />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
