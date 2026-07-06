import type { FeatureExtractionPipeline } from "@xenova/transformers";

// Local sentence-transformer (all-MiniLM-L6-v2, 384-dim). Runs on our own infra
// via WASM — no external API, no key; memory text never leaves the server.
//
// The package is loaded via DYNAMIC import inside getPipe() (not a top-level
// import) so that merely importing this module never triggers the heavy
// WASM/ONNX load. That matters on Vercel serverless, where a top-level import can
// crash the whole route; here, callers that only import (but don't embed) are
// unaffected, and embed() failures are caught by callers (recall falls back to
// strength ordering; saves store a null vector).
export const EMBED_DIM = 384;

let pipe: Promise<FeatureExtractionPipeline> | null = null;
function getPipe() {
  if (!pipe) {
    pipe = import("@xenova/transformers").then(({ pipeline }) =>
      pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { quantized: true }),
    );
  }
  return pipe;
}

// Warm the model in the background (best-effort; never throws).
export async function warmEmbed(): Promise<void> {
  try {
    await getPipe();
  } catch {
    pipe = null; // allow a later retry
  }
}

// Embed one string → a unit-normalized 384-d vector.
export async function embed(text: string): Promise<number[]> {
  const p = await getPipe();
  const out = await p(text.slice(0, 2000), { pooling: "mean", normalize: true });
  return Array.from(out.data as Float32Array);
}

// pgvector literal, e.g. "[0.1,0.2,…]".
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}
