import type { OtpProvider } from "./types.js";

/**
 * Doesn't send anything to a real gateway — logs the "sent" code instead.
 * Real expiry/attempt-limit logic in otp.service.ts still runs against
 * whatever code this "sends", so the flow being tested is realistic except
 * for actual delivery (tech-stack.md §8).
 *
 * Structurally blocked from running in production: see the boot guard in
 * env.ts, which refuses to start the process at all if SMS_PROVIDER=mock
 * (or DEV_OTP_BYPASS_CODE is set) while NODE_ENV=production.
 */
export class MockOtpProvider implements OtpProvider {
  async send(phone: string, code: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[MockOtpProvider] OTP for ${phone}: ${code}`);
  }
}
