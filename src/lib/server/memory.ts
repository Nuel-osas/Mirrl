import { ethers } from "ethers";
import { sql, ensureSchema } from "@/lib/db";
import { walletFor, type UserRow } from "@/lib/server/users";
import { encryptBlob } from "@/lib/server/blobcrypto";
import { uploadBytes } from "@/lib/server/storage";
import { rpcFor, type Network } from "@/lib/og";

export type MemoryDoc = { content: string; rootHash: string | null; version: number; live: boolean };

const HEADER = "# Mirrl memory\n\n";

// Parse the markdown doc back into a flat list of facts.
function factsFromDoc(content: string): string[] {
  return content
    .split("\n")
    .map((l) => l.replace(/^[-*]\s+/, "").trim())
    .filter((l) => l && !l.startsWith("#"));
}

function docFromFacts(facts: string[]): string {
  return HEADER + facts.map((f) => `- ${f}`).join("\n") + "\n";
}

export async function getMemoryDoc(uid: string): Promise<MemoryDoc> {
  await ensureSchema();
  const rows = (await sql`SELECT content, root_hash, version, live FROM memory_docs WHERE user_id = ${uid}`) as Record<string, unknown>[];
  const r = rows[0];
  if (!r) return { content: "", rootHash: null, version: 0, live: false };
  return { content: String(r.content ?? ""), rootHash: (r.root_hash as string) ?? null, version: Number(r.version ?? 0), live: Boolean(r.live) };
}

// What the model sees: committed long-term memory (from 0G) + the pending cache.
export async function buildMemoryContext(uid: string): Promise<string[]> {
  await ensureSchema();
  const doc = await getMemoryDoc(uid);
  const committed = factsFromDoc(doc.content);
  const pendingRows = (await sql`SELECT text FROM memories WHERE user_id = ${uid} ORDER BY created_at DESC LIMIT 60`) as { text: string }[];
  const pending = pendingRows.map((p) => p.text);
  const seen = new Set<string>();
  return [...committed, ...pending].filter((t) => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export type CommitResult =
  | { committed: false }
  | { committed: true; rootHash: string; version: number; count: number; live: boolean; registered: boolean };

const REGISTRY_ABI = ["function setRoot(string newRoot)"];

// Record blob ownership on the MirrlMemory registry (0G Chain). Best-effort —
// the Postgres pointer still holds if the chain write fails.
async function registerOnChain(wallet: ethers.Wallet, net: Network, rootHash: string): Promise<boolean> {
  const addr = process.env.NEXT_PUBLIC_MIRRL_REGISTRY;
  if (!addr || net !== "mainnet") return false; // registry is deployed on mainnet
  try {
    const contract = new ethers.Contract(addr, REGISTRY_ABI, wallet);
    const tx = await contract.setRoot(rootHash);
    await tx.wait();
    return true;
  } catch {
    return false;
  }
}

// Migrate the working cache → consolidated memory.md → 0G Storage, then clear it.
export async function commitMemory(uid: string, user: UserRow, net: Network): Promise<CommitResult> {
  await ensureSchema();
  const pendingRows = (await sql`SELECT text FROM memories WHERE user_id = ${uid} ORDER BY created_at`) as { text: string }[];
  if (pendingRows.length === 0) return { committed: false };

  const doc = await getMemoryDoc(uid);
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const f of [...factsFromDoc(doc.content), ...pendingRows.map((r) => r.text)]) {
    const k = f.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    merged.push(f.trim());
  }

  const content = docFromFacts(merged);
  const wallet = walletFor(user, new ethers.JsonRpcProvider(rpcFor(net)));
  const encrypted = await encryptBlob(Buffer.from(content, "utf8"), wallet);
  const { rootHash, live } = await uploadBytes(encrypted, wallet, net);

  // record ownership of the blob on-chain (wallet → root hash)
  const registered = await registerOnChain(wallet, net, rootHash);

  await sql`
    INSERT INTO memory_docs (user_id, content, root_hash, live, version, updated_at)
    VALUES (${uid}, ${content}, ${rootHash}, ${live}, ${doc.version + 1}, now())
    ON CONFLICT (user_id) DO UPDATE
      SET content = EXCLUDED.content, root_hash = EXCLUDED.root_hash, live = EXCLUDED.live,
          version = EXCLUDED.version, updated_at = now()`;

  // clear the working cache — it now lives on 0G
  await sql`DELETE FROM memories WHERE user_id = ${uid}`;

  return { committed: true, rootHash, version: doc.version + 1, count: pendingRows.length, live, registered };
}
