import { describe, expect, it } from "vitest";
import { generateNumericOtp, generateOpaqueToken, hashPassword, sha256Hex, verifyPassword } from "../src/lib/crypto.js";

describe("password hashing", () => {
  it("hashes and verifies a matching password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects a non-matching password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const [a, b] = await Promise.all([hashPassword("same input"), hashPassword("same input")]);
    expect(a).not.toBe(b);
  });
});

describe("sha256Hex", () => {
  it("is deterministic", () => {
    expect(sha256Hex("abc")).toBe(sha256Hex("abc"));
  });

  it("differs for different input", () => {
    expect(sha256Hex("abc")).not.toBe(sha256Hex("abd"));
  });
});

describe("generateNumericOtp", () => {
  it("generates a code of the requested length, digits only", () => {
    const code = generateNumericOtp(6);
    expect(code).toHaveLength(6);
    expect(/^\d+$/.test(code)).toBe(true);
  });
});

describe("generateOpaqueToken", () => {
  it("generates a sufficiently long, non-repeating token", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
});
