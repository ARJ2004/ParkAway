const INDIA_COUNTRY_CODE = "+91";

/**
 * Masks a phone already normalized by normalize.ts (always +91 + 10 digits)
 * to +91 98******10 (first 2 / last 2 of the national number visible).
 * Deliberately India-only, matching normalizePhone()'s scope for Sprint 1.
 */
export function maskPhone(phone: string): string {
  if (!phone.startsWith(INDIA_COUNTRY_CODE)) return "**********";
  const national = phone.slice(INDIA_COUNTRY_CODE.length);
  if (national.length <= 4) return `${INDIA_COUNTRY_CODE} ${"*".repeat(national.length)}`;
  const first = national.slice(0, 2);
  const last = national.slice(-2);
  const stars = "*".repeat(national.length - 4);
  return `${INDIA_COUNTRY_CODE} ${first}${stars}${last}`;
}

/** Masks an email like driver@example.com -> d***@e***.com */
export function maskEmail(email: string | null): string | null {
  if (!email) return email;
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const maskedLocal = local[0] + "*".repeat(Math.max(local.length - 1, 3));
  const domainParts = domain.split(".");
  const domainHead = domainParts[0] ?? "";
  const domainRest = domainParts.slice(1).join(".");
  const maskedDomain = (domainHead[0] ?? "") + "*".repeat(Math.max(domainHead.length - 1, 3));
  return `${maskedLocal}@${maskedDomain}${domainRest ? `.${domainRest}` : ""}`;
}
