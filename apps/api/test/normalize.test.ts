import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhone, normalizeRegistrationNumber } from "../src/lib/normalize.js";

describe("normalizePhone", () => {
  it("normalizes a bare 10-digit number to E.164", () => {
    expect(normalizePhone("9876543210")).toBe("+919876543210");
  });

  it("normalizes a number already carrying +91", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
  });

  it("normalizes a number with a leading 0 (trunk prefix)", () => {
    expect(normalizePhone("09876543210")).toBe("+919876543210");
  });

  it("normalizes a number with 91 prefix and no plus", () => {
    expect(normalizePhone("919876543210")).toBe("+919876543210");
  });

  it("strips punctuation and whitespace", () => {
    expect(normalizePhone("+91-98765-43210")).toBe("+919876543210");
  });

  it("rejects a number not starting with 6-9 (not a valid Indian mobile prefix)", () => {
    expect(() => normalizePhone("5876543210")).toThrow("INVALID_PHONE");
  });

  it("rejects a too-short number", () => {
    expect(() => normalizePhone("98765")).toThrow("INVALID_PHONE");
  });

  it("rejects a too-long number", () => {
    expect(() => normalizePhone("998765432109")).toThrow("INVALID_PHONE");
  });
});

describe("normalizeRegistrationNumber", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalizeRegistrationNumber(" mh 12 ab 1234 ")).toBe("MH12AB1234");
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Driver@Example.COM  ")).toBe("driver@example.com");
  });
});
