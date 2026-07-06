import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

// Local sentence-transformer (all-MiniLM-L6-v2, 384-dim). Runs on our own infra
// via WASM — no external API, no key; memory text never leaves the server.
export const EMBED_DIM = 384;

let pipe: Promise<FeatureExtractionPipeline> | null = null;
function getPipe() {
  if (!pipe) {
    pipe = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { quantized: true });
  }
  return pipe;
}

// Warm the model (so the first real request isn't slow).
export async function warmEmbed(): Promise<void> {
  await getPipe();
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
