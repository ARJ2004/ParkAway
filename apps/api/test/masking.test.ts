import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone } from "../src/modules/admin/masking.js";

describe("maskPhone", () => {
  it("masks the middle digits of a normalized Indian number", () => {
    expect(maskPhone("+919876543210")).toBe("+91 98******10");
  });
});

describe("maskEmail", () => {
  it("masks the local part and domain head, keeps the TLD", () => {
    const masked = maskEmail("driver@example.com");
    expect(masked).toMatch(/^d\*+@e\*+\.com$/);
    expect(masked?.startsWith("driver")).toBe(false);
    expect(masked?.endsWith(".com")).toBe(true);
  });

  it("passes through null", () => {
    expect(maskEmail(null)).toBeNull();
  });
});
