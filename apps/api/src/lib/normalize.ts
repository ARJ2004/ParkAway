/**
 * Normalizes an Indian mobile number to E.164 (+91XXXXXXXXXX).
 * Accepts common input shapes: "9876543210", "091 98765 43210", "+91-98765-43210".
 * Throws on anything that doesn't resolve to a 10-digit Indian mobile number —
 * this is intentionally strict for Sprint 1 (single micro-market pilot, India-only).
 */
export function normalizePhone(raw: string): string {
  const digitsOnly = raw.replace(/[^\d]/g, "");
  let national = digitsOnly;

  if (national.startsWith("91") && national.length === 12) {
    national = national.slice(2);
  } else if (national.startsWith("0") && national.length === 11) {
    national = national.slice(1);
  }

  if (!/^[6-9]\d{9}$/.test(national)) {
    throw new Error("INVALID_PHONE");
  }

  return `+91${national}`;
}

export function normalizeRegistrationNumber(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
