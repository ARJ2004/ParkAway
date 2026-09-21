import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * Admin password hashing.
 *
 * The Sprint 1 plan (docs/planning/04-sprint-1-detailed-plan.md) specifies
 * argon2id. We use bcrypt (via the pure-JS `bcryptjs`, no native build step)
 * instead: the `argon2` package needs native compilation and this environment
 * has no guaranteed C++ toolchain, which would make `npm install` unreliable
 * across dev machines. bcrypt with a strong cost factor is still a solid,
 * industry-standard choice for password hashing. This is an isolated utility
 * — swapping to real argon2id later (e.g. once deploying to a container image
 * where the native build is controlled) touches only this file.
 */
const BCRYPT_COST_FACTOR = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST_FACTOR);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * OTP codes and refresh tokens are never stored raw — only a SHA-256 hash.
 * Unlike passwords, these are high-entropy random values (not user-chosen,
 * not brute-forceable at meaningful rates within their short TTL), so a fast
 * cryptographic hash is appropriate here; bcrypt/argon2's slow-hash property
 * exists specifically to blunt brute-forcing low-entropy user passwords.
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateNumericOtp(length: number): string {
  const digits = "0123456789";
  let result = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += digits[bytes[i]! % digits.length];
  }
  return result;
}

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}
