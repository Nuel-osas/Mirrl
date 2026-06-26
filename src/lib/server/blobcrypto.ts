import crypto from "node:crypto";
import { ethers } from "ethers";

// Wallet-derived AES-GCM ("0x01" scheme, ported from Cortex). The key is derived
// from a deterministic signature by the user's wallet and never stored — so the
// encrypted memory.md blob on 0G Storage is decryptable only by re-deriving from
// the wallet. Layout: [0x01][iv:12][tag:16][ciphertext].
const LABEL = "mirrl:memory-key:v1";
const TAG = 0x01;

async function deriveKey(wallet: ethers.Wallet): Promise<Buffer> {
  const sig = await wallet.signMessage(LABEL);
  return crypto.createHash("sha256").update(sig).digest(); // 32 bytes
}

export async function encryptBlob(plaintext: Buffer, wallet: ethers.Wallet): Promise<Buffer> {
  const key = await deriveKey(wallet);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([TAG]), iv, tag, ct]);
}

export async function decryptBlob(blob: Buffer, wallet: ethers.Wallet): Promise<Buffer> {
  if (blob[0] !== TAG) throw new Error("unsupported blob format");
  const iv = blob.subarray(1, 13);
  const tag = blob.subarray(13, 29);
  const ct = blob.subarray(29);
  const key = await deriveKey(wallet);
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}
