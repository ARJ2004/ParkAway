/**
 * Every SMS/OTP integration goes through this interface — business logic
 * never calls a vendor SDK directly (tech-stack.md §8, non-negotiable rule #4).
 * Which concrete implementation is wired up is a config choice (SMS_PROVIDER
 * env var), not a code change in the modules that use it.
 */
export interface OtpProvider {
  /** Sends (or, for the mock, logs) an OTP code to the given phone number. */
  send(phone: string, code: string): Promise<void>;
}
