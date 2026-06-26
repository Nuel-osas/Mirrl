import crypto from "node:crypto";

const KEY_VERSION = 1;
const ALG = "aes-256-gcm";

function masterKey(): Buffer {
  const b64 = process.env.AES_MASTER_KEY;
  if (!b64) throw new Error("AES_MASTER_KEY not set");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("AES_MASTER_KEY must be 32 bytes (base64)");
  return key;
}

export type EncryptedBlob = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
};

/** Encrypt arbitrary bytes (e.g. a wallet private key) at rest. */
export function aesEncrypt(plaintext: Buffer): EncryptedBlob {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALG, masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag, keyVersion: KEY_VERSION };
}

/** Decrypt — throws if the auth tag doesn't verify (tamper detection). */
export function aesDecrypt(blob: { ciphertext: Buffer; iv: Buffer; authTag: Buffer; keyVersion: number }): Buffer {
  if (blob.keyVersion !== KEY_VERSION) {
    throw new Error(`Unsupported key version: ${blob.keyVersion}`);
  }
  const decipher = crypto.createDecipheriv(ALG, masterKey(), blob.iv);
  decipher.setAuthTag(blob.authTag);
  return Buffer.concat([decipher.update(blob.ciphertext), decipher.final()]);
}
