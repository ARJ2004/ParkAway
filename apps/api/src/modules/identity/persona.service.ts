import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { userRoles, users } from "../../db/schema.js";
import { recordAudit } from "../../lib/audit.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";

export type Persona = "driver" | "owner";
const VALID_PERSONAS: Persona[] = ["driver", "owner"];

export interface PersonasResponse {
  available: Persona[];
  granted: Array<"driver" | "host">;
  lastPersona: Persona | null;
}

/**
 * `lastPersona: null` is what tells the client to show the picker — a
 * first-login moment, not a per-login toll (AC-1, AC-3).
 */
export async function getPersonas(db: Db, userId: string): Promise<PersonasResponse> {
  const [user] = await db.select({ lastPersona: users.lastPersona }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new NotFoundError("User not found");

  const hostGrant = await hasLiveRoleGrant(db, userId, "host");

  return {
    available: ["driver", "owner"],
    granted: hostGrant ? ["driver", "host"] : ["driver"],
    lastPersona: (user.lastPersona as Persona | null) ?? null,
  };
}

/**
 * Grants `host` on first selection of `owner` (idempotent — re-selecting an
 * already-granted persona is a 200 no-op, not a duplicate grant: AC-2, R —
 * two concurrent taps race on `user_roles_live_grant_unique_idx` and the
 * loser just observes the row already exists). Persists `last_persona`.
 * Audited: `persona.role_granted` on a genuine new grant, `persona.switched`
 * whenever the stored persona actually changes.
 */
export async function selectPersona(db: Db, userId: string, persona: string, source: string | null): Promise<PersonasResponse> {
  if (!VALID_PERSONAS.includes(persona as Persona)) {
    throw new ValidationError(`persona must be one of: ${VALID_PERSONAS.join(", ")}`);
  }

  return db.transaction(async (tx) => {
    const [user] = await tx.select({ lastPersona: users.lastPersona }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new NotFoundError("User not found");

    let grantedHostNow = false;
    if (persona === "owner") {
      try {
        // A unique-violation here aborts the *whole* enclosing Postgres
        // transaction, not just this statement — any further query on `tx`
        // after catching it would fail with "current transaction is aborted"
        // even though the violation itself is an expected, idempotent case.
        // Wrapping just this insert in a nested `tx.transaction()` (a real
        // SAVEPOINT) means only the savepoint rolls back on conflict, and
        // the outer transaction stays usable for the update/audit below.
        await tx.transaction(async (tx2) => {
          await tx2.insert(userRoles).values({
            userId,
            role: "host",
            scopeType: null,
            scopeId: null,
            grantedByType: "self",
            grantedByUserId: null,
          });
        });
        grantedHostNow = true;
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // Already granted — either from a previous session or the losing
        // side of a concurrent double-tap. Idempotent no-op either way.
      }
    }

    const previousPersona = user.lastPersona as Persona | null;
    const changed = previousPersona !== persona;
    if (changed) {
      await tx.update(users).set({ lastPersona: persona, updatedAt: new Date() }).where(eq(users.id, userId));
    }

    if (grantedHostNow) {
      await recordAudit(tx, {
        actorType: "driver",
        actorId: userId,
        action: "persona.role_granted",
        targetType: "user",
        targetId: userId,
        source,
        metadata: { role: "host" },
      });
    }
    if (changed) {
      await recordAudit(tx, {
        actorType: "driver",
        actorId: userId,
        action: "persona.switched",
        targetType: "user",
        targetId: userId,
        source,
        metadata: { from: previousPersona, to: persona },
      });
    }

    const hostGrant = grantedHostNow || (await hasLiveRoleGrant(tx, userId, "host"));
    return {
      available: ["driver", "owner"] satisfies Persona[],
      granted: (hostGrant ? ["driver", "host"] : ["driver"]) as Array<"driver" | "host">,
      lastPersona: persona as Persona,
    };
  });
}

async function hasLiveRoleGrant(db: Pick<Db, "select">, userId: string, role: "host" | "property_manager"): Promise<boolean> {
  const [grant] = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role), isNull(userRoles.revokedAt)))
    .limit(1);
  return Boolean(grant);
}
