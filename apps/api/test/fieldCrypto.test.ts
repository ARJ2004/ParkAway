import { describe, expect, it } from "vitest";
import { decryptField, encryptField } from "../src/lib/fieldCrypto.js";

describe("fieldCrypto", () => {
  it("round-trips: encrypt then decrypt returns the original plaintext", () => {
    const original = "123456789012";
    const { ciphertext, keyVersion } = encryptField(original);
    expect(decryptField(ciphertext, keyVersion)).toBe(original);
  });

  it("the stored ciphertext does not contain the plaintext account number as a substring", () => {
    const original = "987654321098";
    const { ciphertext } = encryptField(original);
    expect(ciphertext).not.toContain(original);
    // Also guard against a base64-of-plaintext mistake specifically, not just raw substring.
    expect(ciphertext).not.toContain(Buffer.from(original).toString("base64"));
  });

  it("a tampered ciphertext throws rather than returning garbage", () => {
    const { ciphertext, keyVersion } = encryptField("111122223333");
    const raw = Buffer.from(ciphertext, "base64");
    raw[raw.length - 1] = (raw[raw.length - 1]! ^ 0xff) & 0xff; // flip the last byte of the ciphertext
    const tampered = raw.toString("base64");
    expect(() => decryptField(tampered, keyVersion)).toThrow();
  });

  it("a tampered auth tag throws rather than returning garbage", () => {
    const { ciphertext, keyVersion } = encryptField("444455556666");
    const raw = Buffer.from(ciphertext, "base64");
    raw[12] = (raw[12]! ^ 0xff) & 0xff; // byte 12 is inside the 16-byte auth tag (iv is bytes 0-11)
    const tampered = raw.toString("base64");
    expect(() => decryptField(tampered, keyVersion)).toThrow();
  });

  it("two encryptions of the same plaintext produce different ciphertext (random IV per value)", () => {
    const a = encryptField("555566667777");
    const b = encryptField("555566667777");
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
});
