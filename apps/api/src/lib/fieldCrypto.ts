import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../env.js";

/**
 * AES-256-GCM encrypt/decrypt for at-rest column values — currently only the
 * host payout account number (05-sprint-2-detailed-plan.md §2.3's payout
 * note, locked decision 11). Deliberately the only file that reads
 * `PAYOUT_ENCRYPTION_KEY`.
 *
 * Two rules enforced by review and by grep, not just by convention:
 *  - `decryptField` has exactly two call sites in the whole codebase: the
 *    Sprint 6 payout execution path (not built yet) and the admin reveal
 *    service (modules/admin/payout-reveal.service.ts).
 *  - No service returns its result upward into a serialized response
 *    object — the reveal endpoint returns it directly and nothing stores it.
 */
const IV_LENGTH_BYTES = 12; // GCM standard
const AUTH_TAG_LENGTH_BYTES = 16;

function loadKey(): Buffer {
  if (!env.PAYOUT_ENCRYPTION_KEY) {
    throw new Error(
      "PAYOUT_ENCRYPTION_KEY is not set — cannot encrypt or decrypt payout data. " +
        "Generate one with `openssl rand -hex 32` and set it before any host enters a payout account."
    );
  }
  const key = Buffer.from(env.PAYOUT_ENCRYPTION_KEY, "hex");
  if (key.length !== 32) {
    throw new Error("PAYOUT_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

export interface EncryptedField {
  ciphertext: string; // base64(iv ‖ authTag ‖ ciphertext)
  keyVersion: number;
}

export function encryptField(plaintext: string): EncryptedField {
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([iv, authTag, encrypted]).toString("base64"),
    keyVersion: env.PAYOUT_KEY_VERSION,
  };
}

/**
 * `keyVersion` is accepted but unused today — there is only ever one active
 * key (`PAYOUT_ENCRYPTION_KEY`/`PAYOUT_KEY_VERSION`). It exists in the
 * signature now so a future rotation (a background re-encrypt keyed by
 * `payout_key_version < current`, per Nikhil §9) is a change to this
 * function's body, not to every call site.
 */
export function decryptField(ciphertext: string, _keyVersion: number): string {
  const key = loadKey();
  const raw = Buffer.from(ciphertext, "base64");
  const iv = raw.subarray(0, IV_LENGTH_BYTES);
  const authTag = raw.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const encrypted = raw.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
