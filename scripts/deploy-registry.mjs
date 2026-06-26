// Compile + deploy MirrlMemory.sol to 0G.  Usage: node scripts/deploy-registry.mjs [testnet|mainnet]
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { ethers } from "ethers";
import solc from "solc";
import { neon } from "@neondatabase/serverless";

const NET = process.argv[2] === "mainnet" ? "mainnet" : "testnet";
const RPC = NET === "mainnet" ? "https://evmrpc.0g.ai" : "https://evmrpc-testnet.0g.ai";

// --- load env ---
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

// --- deployer wallet: explicit key, else decrypt the custodial wallet ---
function toBuf(v) {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  if (typeof v === "string" && v.startsWith("\\x")) return Buffer.from(v.slice(2), "hex");
  return Buffer.from(v);
}
async function deployerKey() {
  if (env.DEPLOYER_PRIVATE_KEY) return env.DEPLOYER_PRIVATE_KEY;
  const sql = neon(env.DATABASE_URL);
  const rows = await sql`SELECT encrypted_priv, iv, auth_tag FROM users ORDER BY created_at LIMIT 1`;
  if (!rows[0]) throw new Error("no funded wallet found (no users, no DEPLOYER_PRIVATE_KEY)");
  const key = Buffer.from(env.AES_MASTER_KEY, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", key, toBuf(rows[0].iv));
  d.setAuthTag(toBuf(rows[0].auth_tag));
  return Buffer.concat([d.update(toBuf(rows[0].encrypted_priv)), d.final()]).toString();
}

// --- compile ---
const source = readFileSync(new URL("../contracts/MirrlMemory.sol", import.meta.url), "utf8");
const out = JSON.parse(solc.compile(JSON.stringify({
  language: "Solidity",
  sources: { "MirrlMemory.sol": { content: source } },
  settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
})));
if (out.errors?.some((e) => e.severity === "error")) {
  console.error(out.errors.map((e) => e.formattedMessage).join("\n"));
  process.exit(1);
}
const c = out.contracts["MirrlMemory.sol"].MirrlMemory;

// --- deploy ---
const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(await deployerKey(), provider);
console.log(`deployer ${wallet.address} on ${NET}`);
const bal = await provider.getBalance(wallet.address);
console.log(`balance ${ethers.formatEther(bal)} 0G`);
if (bal === 0n) throw new Error(`deployer has no ${NET} gas — fund ${wallet.address}`);

const factory = new ethers.ContractFactory(c.abi, c.evm.bytecode.object, wallet);
const contract = await factory.deploy();
await contract.waitForDeployment();
const addr = await contract.getAddress();
console.log(`\n✅ MirrlMemory deployed: ${addr}`);
console.log(`\nAdd to .env.local:\nNEXT_PUBLIC_MIRRL_REGISTRY=${addr}`);
