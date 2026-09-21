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

/**
 * Standard Indian vehicle registration format: 2-letter state code, 1-2 digit
 * RTO district code, 0-2 letter series (many plates have none, or up to 2 —
 * e.g. "KA05HR1096"), 4-digit unique number. Deliberately excludes newer/rarer
 * formats (BH-series, diplomatic, defence) — this is a single-micro-market
 * India pilot, not a national rollout; revisit if a real user hits this.
 */
const INDIAN_REGISTRATION_NUMBER_RE = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,2}[0-9]{4}$/;

export function isValidIndianRegistrationNumber(normalized: string): boolean {
  return INDIAN_REGISTRATION_NUMBER_RE.test(normalized);
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
