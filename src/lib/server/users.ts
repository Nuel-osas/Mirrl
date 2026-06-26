import { ethers } from "ethers";
import { sql, ensureSchema } from "@/lib/db";
import { aesEncrypt, aesDecrypt } from "@/lib/server/crypto";

export type UserRow = {
  id: number;
  google_sub: string;
  email: string;
  name: string | null;
  picture: string | null;
  wallet_address: string;
  encrypted_priv: Buffer;
  iv: Buffer;
  auth_tag: Buffer;
  key_version: number;
  exported_at: Date | null;
};

function toBuf(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  if (typeof v === "string" && v.startsWith("\\x")) return Buffer.from(v.slice(2), "hex");
  return Buffer.from(v as ArrayBuffer);
}

export async function findUserByGoogleSub(googleSub: string): Promise<UserRow | null> {
  await ensureSchema();
  const rows = (await sql`SELECT * FROM users WHERE google_sub = ${googleSub} LIMIT 1`) as unknown as UserRow[];
  return rows[0] ?? null;
}

/** Create a user with a freshly minted, AES-encrypted custodial 0G wallet. */
export async function createUserWithWallet(args: {
  googleSub: string;
  email: string;
  name?: string | null;
  picture?: string | null;
}): Promise<UserRow> {
  await ensureSchema();
  const wallet = ethers.Wallet.createRandom();
  const enc = aesEncrypt(Buffer.from(wallet.privateKey)); // store the 0x-hex key, encrypted

  const rows = (await sql`
    INSERT INTO users (google_sub, email, name, picture, wallet_address, encrypted_priv, iv, auth_tag, key_version)
    VALUES (
      ${args.googleSub}, ${args.email}, ${args.name ?? null}, ${args.picture ?? null},
      ${wallet.address}, ${enc.ciphertext}, ${enc.iv}, ${enc.authTag}, ${enc.keyVersion}
    )
    RETURNING *`) as unknown as UserRow[];
  return rows[0];
}

export async function touchLogin(googleSub: string): Promise<void> {
  await ensureSchema();
  await sql`UPDATE users SET last_login_at = now() WHERE google_sub = ${googleSub}`;
}

export async function markExported(googleSub: string): Promise<void> {
  await ensureSchema();
  await sql`UPDATE users SET exported_at = now() WHERE google_sub = ${googleSub}`;
}

/**
 * Decrypt a user's custodial key and return an ethers Wallet — used server-side
 * to pay for 0G Compute inference and 0G Storage on the user's behalf (no popups).
 */
export function walletFor(user: UserRow, provider?: ethers.Provider): ethers.Wallet {
  const key = aesDecrypt({
    ciphertext: toBuf(user.encrypted_priv),
    iv: toBuf(user.iv),
    authTag: toBuf(user.auth_tag),
    keyVersion: user.key_version,
  }).toString();
  return new ethers.Wallet(key, provider);
}
