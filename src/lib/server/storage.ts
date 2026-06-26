import crypto from "node:crypto";
import { ethers } from "ethers";
import { Blob as ZgBlob, Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { rpcFor, indexerFor, type Network } from "@/lib/og";

export type UploadResult = { rootHash: string; live: boolean; note?: string };

// Upload bytes to 0G Storage and return the content root hash. Falls back to a
// deterministic local hash (so the commit flow still records a pointer) when the
// wallet is unfunded for storage or the indexer is unreachable.
export async function uploadBytes(bytes: Buffer, wallet: ethers.Wallet, net: Network): Promise<UploadResult> {
  try {
    const file = new File([new Uint8Array(bytes)], "memory.md", { type: "text/markdown" });
    const blob = new ZgBlob(file);
    const [tree, treeErr] = await blob.merkleTree();
    if (treeErr || !tree) throw treeErr ?? new Error("merkle tree failed");
    const rootHash = tree.rootHash();
    if (!rootHash) throw new Error("no root hash");

    const indexer = new Indexer(indexerFor(net));
    const [, uploadErr] = await indexer.upload(blob, rpcFor(net), wallet);
    if (uploadErr) throw uploadErr;

    return { rootHash: String(rootHash), live: true };
  } catch (e) {
    const rootHash = "0x" + crypto.createHash("sha256").update(bytes).digest("hex");
    return { rootHash, live: false, note: (e as Error).message };
  }
}

// Download + return raw bytes for a root hash (used to verify / restore memory).
export async function downloadBytes(rootHash: string, net: Network): Promise<Buffer | null> {
  try {
    const indexer = new Indexer(indexerFor(net));
    const [zblob, err] = await indexer.downloadToBlob(rootHash);
    const inner = (zblob as unknown as { blob: File | null } | null)?.blob;
    if (err || !inner) return null;
    const ab = await inner.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}
