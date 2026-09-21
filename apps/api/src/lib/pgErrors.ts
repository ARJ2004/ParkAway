/**
 * Postgres unique-violation code (23505). drizzle-orm wraps the real
 * PostgresError inside a DrizzleQueryError, with the original as `.cause` —
 * the code lives there, not on the outer error, so both layers are checked.
 */
export function isUniqueViolation(err: unknown): boolean {
  return hasPgCode(err, "23505") || hasPgCode(getCause(err), "23505");
}

/**
 * Which unique constraint was violated, so callers can decide the right
 * recovery action per constraint rather than treating every 23505 the same
 * way. Parsed from the error message text (present on both the outer
 * DrizzleQueryError and the inner PostgresError `.cause`) rather than a
 * driver-specific field, so it doesn't depend on postgres.js's exact error
 * shape.
 */
export function pgConstraintName(err: unknown): string | undefined {
  const message = messageOf(err) ?? messageOf(getCause(err));
  return message ? /constraint "([^"]+)"/.exec(message)?.[1] : undefined;
}

function messageOf(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "message" in err && typeof (err as { message: unknown }).message === "string"
    ? (err as { message: string }).message
    : undefined;
}

function getCause(err: unknown): unknown {
  return typeof err === "object" && err !== null && "cause" in err ? (err as { cause: unknown }).cause : undefined;
}

function hasPgCode(err: unknown, code: string): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === code;
}
