// 0G Compute Network integration helpers (server-side).
// Mirrl runs on 0G: inference via 0G Compute, memory via 0G Storage.
// Free Qwen models on testnet; the full frontier catalog on mainnet.

export const OG = {
  testnet: {
    name: "Galileo Testnet",
    rpc: "https://evmrpc-testnet.0g.ai",
    storageIndexer: "https://indexer-storage-testnet-turbo.0g.ai",
    explorer: "https://chainscan-galileo.0g.ai",
    faucet: "https://faucet.0g.ai",
    chainId: 16601,
  },
  mainnet: {
    name: "0G Mainnet",
    rpc: "https://evmrpc.0g.ai",
    storageIndexer: "https://indexer-storage-turbo.0g.ai",
    chainId: 16661,
  },
} as const;

export type Network = "testnet" | "mainnet";

export function rpcFor(network: Network): string {
  return network === "mainnet" ? OG.mainnet.rpc : OG.testnet.rpc;
}

export function indexerFor(network: Network): string {
  return network === "mainnet" ? OG.mainnet.storageIndexer : OG.testnet.storageIndexer;
}

export type OgModel = {
  provider: string;
  model: string;
  label: string;
  type: "chatbot" | "image" | "speech";
  verifiable: boolean;
  live: boolean;
  /** curation rank (1 = best); null when not curated */
  rank: number | null;
  /** short curated tagline shown in the picker */
  note?: string;
};

// The best model Mirrl reaches for by default (mainnet).
export const DEFAULT_MODEL = "deepseek-v4-pro";

// Curated "best of 0G" — promoted to the top of the picker. Matched by model id.
export const CURATED: { model: string; rank: number; note: string }[] = [
  { model: "deepseek-v4-pro", rank: 1, note: "Best reasoning" },
  { model: "openai/gpt-5.4-mini", rank: 2, note: "Fast frontier" },
  { model: "qwen3.7-max", rank: 3, note: "Top Qwen" },
  { model: "glm-5.1", rank: 4, note: "Frontier GLM" },
  { model: "0GM-1.0-35B-A3B", rank: 5, note: "0G-native" },
];

export function curatedInfo(id: string) {
  const c = CURATED.find((x) => x.model.toLowerCase() === id.toLowerCase());
  return c ? { rank: c.rank, note: c.note } : { rank: null as number | null, note: undefined };
}

// Per-network fallbacks, used only when the live marketplace query fails.
const mk = (model: string, type: OgModel["type"]): OgModel => {
  const { rank, note } = curatedInfo(model);
  return { provider: "0g", model, label: prettyModel(model), type, verifiable: true, live: false, rank, note };
};

export const TESTNET_FALLBACK: OgModel[] = [
  mk("qwen/qwen2.5-omni-7b", "chatbot"),
  mk("qwen/qwen-image-edit-2511", "image"),
];

export const MAINNET_FALLBACK: OgModel[] = [
  mk("deepseek-v4-pro", "chatbot"),
  mk("openai/gpt-5.4-mini", "chatbot"),
  mk("qwen3.7-max", "chatbot"),
  mk("glm-5.1", "chatbot"),
  mk("0GM-1.0-35B-A3B", "chatbot"),
  mk("deepseek-v4-flash", "chatbot"),
  mk("MiniMax-M3", "chatbot"),
  mk("openai/whisper-large-v3", "speech"),
  mk("z-image-turbo", "image"),
];

export function fallbackFor(network: Network): OgModel[] {
  return network === "mainnet" ? MAINNET_FALLBACK : TESTNET_FALLBACK;
}

// Best available model id for a network (used to auto-select a sensible default).
export function bestAvailable(models: OgModel[]): string | undefined {
  const ranked = models.filter((m) => m.rank != null).sort((a, b) => a.rank! - b.rank!);
  if (ranked.find((m) => m.model === DEFAULT_MODEL)) return DEFAULT_MODEL;
  return (ranked[0] ?? models.find((m) => m.type === "chatbot") ?? models[0])?.model;
}

export function prettyModel(id: string): string {
  const base = id.includes("/") ? id.split("/").pop()! : id;
  return base
    .replace(/[-_]/g, " ")
    .replace(/\b(\w)/g, (m) => m.toUpperCase())
    .replace(/\bFp8\b/i, "FP8")
    .replace(/\bGlm\b/i, "GLM");
}

export function classifyService(serviceType?: string): OgModel["type"] {
  const t = (serviceType || "").toLowerCase();
  if (t.includes("image")) return "image";
  if (t.includes("speech") || t.includes("audio") || t.includes("whisper")) return "speech";
  return "chatbot";
}

// Sort: curated/featured first (by rank), then chat, then everything else.
export function sortModels(models: OgModel[]): OgModel[] {
  const typeRank = { chatbot: 0, speech: 1, image: 2 } as const;
  return [...models].sort((a, b) => {
    if (a.rank != null && b.rank != null) return a.rank - b.rank;
    if (a.rank != null) return -1;
    if (b.rank != null) return 1;
    if (typeRank[a.type] !== typeRank[b.type]) return typeRank[a.type] - typeRank[b.type];
    return a.label.localeCompare(b.label);
  });
}
