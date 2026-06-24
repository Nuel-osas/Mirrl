// 0G Compute Network integration helpers (server-side).
// Mirrl runs entirely on the 0G Galileo testnet: inference via 0G Compute,
// memory persistence via 0G Storage. The chain stays invisible to the user.

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
    chainId: 16661,
  },
} as const;

export type OgModel = {
  /** provider wallet address on the 0G Compute marketplace */
  provider: string;
  /** model id reported by the provider */
  model: string;
  /** human label shown in the UI */
  label: string;
  /** chatbot | image | speech */
  type: "chatbot" | "image" | "speech";
  /** TEE / verifiable attestation available */
  verifiable: boolean;
  /** true when this came from a live marketplace query, false for fallback */
  live: boolean;
};

// Fallback catalog used when the live marketplace query is unavailable.
// The live list (via broker.inference.listService) supersedes this at runtime.
export const FALLBACK_MODELS: OgModel[] = [
  { provider: "0g-testnet", model: "qwen2.5-7b-instruct", label: "Qwen 2.5 7B Instruct", type: "chatbot", verifiable: true, live: false },
  { provider: "0g-testnet", model: "llama-3.3-70b-instruct", label: "Llama 3.3 70B Instruct", type: "chatbot", verifiable: true, live: false },
  { provider: "0g-testnet", model: "deepseek-r1-70b", label: "DeepSeek R1 70B", type: "chatbot", verifiable: true, live: false },
  { provider: "0g-testnet", model: "gpt-oss-120b", label: "GPT-OSS 120B", type: "chatbot", verifiable: true, live: false },
  { provider: "0g-testnet", model: "qwen-image-edit-2511", label: "Qwen Image Edit 2511", type: "image", verifiable: true, live: false },
];

export function prettyModel(id: string): string {
  return id
    .replace(/[-_]/g, " ")
    .replace(/\b(\w)/g, (m) => m.toUpperCase())
    .replace(/\bLlm\b/i, "LLM");
}

export function classifyService(serviceType?: string): OgModel["type"] {
  const t = (serviceType || "").toLowerCase();
  if (t.includes("image")) return "image";
  if (t.includes("speech") || t.includes("audio") || t.includes("whisper")) return "speech";
  return "chatbot";
}
