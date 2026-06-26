import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Distill a source (note/file text) into clean, self-contained fact memories.
// Deterministic heuristic — works with no inference. (LLM distillation via 0G
// Compute is a drop-in upgrade on top of this.)
export async function POST(req: NextRequest) {
  const { text, title } = (await req.json()) as { text?: string; title?: string };
  const body = (text ?? "").trim();
  if (!body) return NextResponse.json({ facts: [] });

  const facts = heuristicExtract(body, title);
  return NextResponse.json({ facts, source: "heuristic" });
}

function heuristicExtract(text: string, title?: string): string[] {
  const cleaned = text.replace(/\r/g, "");
  // split on line breaks, bullets, and sentence boundaries
  const raw = cleaned
    .split(/\n+|(?<=[.!?])\s+|\s*[•\-*]\s+/g)
    .map((s) =>
      s
        .replace(/^[\s•\-*#>\d.)]+/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);

  const seen = new Set<string>();
  const facts: string[] = [];
  for (const f of raw) {
    const words = f.split(/\s+/);
    if (words.length < 3) continue; // skip fragments
    if (f.length > 240) continue; // skip walls of text
    const key = f.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push(f.replace(/[.;]+$/, ""));
    if (facts.length >= 8) break;
  }

  // fall back to the whole thing (or the title) if nothing distilled
  if (facts.length === 0) {
    const fallback = (title ? `${title}: ` : "") + text.slice(0, 200).trim();
    return [fallback];
  }
  return facts;
}
