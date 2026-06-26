import { defineChain } from "viem";

// 0G mainnet — chain id 16661
export const ogMainnet = defineChain({
  id: 16661,
  name: "0G",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc.0g.ai"] } },
  blockExplorers: { default: { name: "0G Scan", url: "https://chainscan.0g.ai" } },
});

// 0G Galileo testnet — chain id 16602
export const ogTestnet = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc-testnet.0g.ai"] } },
  blockExplorers: { default: { name: "0G Galileo Scan", url: "https://chainscan-galileo.0g.ai" } },
  testnet: true,
});
