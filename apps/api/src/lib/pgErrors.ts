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
 * way.
 *
 * Checks both the outer error and `.cause` (drizzle-orm wraps the real
 * PostgresError inside a DrizzleQueryError). Reads postgres.js's
 * `constraint_name` field directly rather than regex-parsing `.message` —
 * an earlier version used `messageOf(err) ?? messageOf(getCause(err))`,
 * which never actually reached the cause: the outer DrizzleQueryError's
 * `.message` is always the SQL query text (a non-empty string), so the `??`
 * short-circuited before ever looking at the cause's message, where the
 * "duplicate key value violates unique constraint "..."" text actually
 * lives. That meant this function silently always returned undefined,
 * and both call sites' constraint-specific recovery logic (the default-
 * vehicle race retry in vehicle.service.ts, and this same duplicate-
 * registration check) never actually ran — caught by the Testcontainers
 * test for global vehicle-registration uniqueness, which asserted the
 * *converted* ConflictError, not just "something rejected."
 */
export function pgConstraintName(err: unknown): string | undefined {
  return constraintNameOf(err) ?? constraintNameOf(getCause(err));
}

function constraintNameOf(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  if ("constraint_name" in err && typeof (err as { constraint_name: unknown }).constraint_name === "string") {
    return (err as { constraint_name: string }).constraint_name;
  }
  const message = messageOf(err);
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
