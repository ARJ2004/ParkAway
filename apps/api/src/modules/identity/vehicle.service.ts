import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { vehicles } from "../../db/schema.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { isValidIndianRegistrationNumber, normalizeRegistrationNumber } from "../../lib/normalize.js";
import { isUniqueViolation, pgConstraintName } from "../../lib/pgErrors.js";

const VALID_TYPES = ["hatchback", "sedan", "suv", "bike", "commercial"] as const;
type VehicleType = (typeof VALID_TYPES)[number];

const REGISTRATION_UNIQUE_CONSTRAINT = "vehicles_registration_no_active_idx";
const DEFAULT_UNIQUE_CONSTRAINT = "vehicles_user_id_default_unique_idx";

export interface AddVehicleParams {
  registrationNo: string;
  type: string;
  makeModel?: string;
}

export async function listVehicles(db: Db, userId: string) {
  return db.select().from(vehicles).where(eq(vehicles.userId, userId)).orderBy(vehicles.createdAt);
}

export async function addVehicle(db: Db, userId: string, params: AddVehicleParams) {
  if (!VALID_TYPES.includes(params.type as VehicleType)) {
    throw new ValidationError(`type must be one of: ${VALID_TYPES.join(", ")}`);
  }

  const registrationNo = normalizeRegistrationNumber(params.registrationNo);
  if (!isValidIndianRegistrationNumber(registrationNo)) {
    throw new ValidationError(
      "registrationNo must be a valid Indian registration number, e.g. KA05HR1096 (state code, RTO code, optional series, 4-digit number)"
    );
  }

  return db.transaction(async (tx) => {
    const existingActive = await tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.userId, userId), eq(vehicles.status, "active")));

    try {
      // Nested `tx.transaction()` = a real SAVEPOINT. A unique-violation on
      // this insert aborts the *whole* enclosing Postgres transaction, not
      // just this statement — without the savepoint, the fallback insert in
      // the DEFAULT_UNIQUE_CONSTRAINT branch below would itself fail with
      // "current transaction is aborted, commands ignored until end of
      // transaction block" even though it's the intended, idempotent
      // recovery path (found via the identical bug in
      // identity/persona.service.ts — same fix applied here).
      const created = await tx.transaction(async (tx2) => {
        const [row] = await tx2
          .insert(vehicles)
          .values({
            userId,
            registrationNo,
            type: params.type,
            makeModel: params.makeModel,
            // First active vehicle becomes default automatically — a driver
            // with exactly one vehicle should never have to take an extra step
            // to make it selectable as their default.
            isDefault: existingActive.length === 0,
          })
          .returning();
        if (!row) throw new Error("Vehicle insert returned no row");
        return row;
      });
      return created;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;

      const constraint = pgConstraintName(err);
      if (constraint === DEFAULT_UNIQUE_CONSTRAINT) {
        // Lost a race with another concurrent "add my first vehicle" request
        // for this same user — someone else's insert already claimed default
        // in between our read and our write. Safe recovery: insert this one
        // as non-default rather than failing the whole request.
        const [created] = await tx
          .insert(vehicles)
          .values({ userId, registrationNo, type: params.type, makeModel: params.makeModel, isDefault: false })
          .returning();
        if (!created) throw new Error("Vehicle insert returned no row", { cause: err });
        return created;
      }

      if (constraint === REGISTRATION_UNIQUE_CONSTRAINT) {
        // Global uniqueness (confirmed with the user 2026-09-21): this plate
        // is active on some account right now — not necessarily this one —
        // so the message must not imply it's already on "your" account.
        throw new ConflictError(
          "DUPLICATE_VEHICLE",
          "This registration number is already active on another account. If you've bought this vehicle, ask the previous owner to remove it from their account first."
        );
      }
      throw err;
    }
  });
}

export interface UpdateVehicleParams {
  makeModel?: string;
  isDefault?: boolean;
  status?: "active" | "inactive";
}

const MAX_DEFAULT_SWAP_RETRIES = 3;

export async function updateVehicle(db: Db, userId: string, vehicleId: string, patch: UpdateVehicleParams) {
  for (let attempt = 1; attempt <= MAX_DEFAULT_SWAP_RETRIES; attempt++) {
    try {
      return await attemptUpdateVehicle(db, userId, vehicleId, patch);
    } catch (err) {
      const isDefaultRace = isUniqueViolation(err) && pgConstraintName(err) === DEFAULT_UNIQUE_CONSTRAINT;
      // Only retry the specific race this constraint exists to catch — two
      // concurrent set-default calls for different vehicles both unsetting
      // "whatever was previously default" before either commits its own new
      // default (see the CHECK/index comment in db/schema.ts and the
      // concurrency test that caught this). Anything else propagates as-is.
      if (!isDefaultRace || attempt === MAX_DEFAULT_SWAP_RETRIES) {
        if (isDefaultRace) {
          throw new ConflictError(
            "DEFAULT_VEHICLE_CONFLICT",
            "Another update to your default vehicle happened at the same time — please retry"
          );
        }
        throw err;
      }
      // Retry: re-read current state and reapply — by the next attempt the
      // losing transaction's rollback has already released the conflict.
    }
  }
  throw new Error("unreachable");
}

async function attemptUpdateVehicle(db: Db, userId: string, vehicleId: string, patch: UpdateVehicleParams) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(vehicles)
      .where(and(eq(vehicles.id, vehicleId), eq(vehicles.userId, userId)))
      .limit(1);
    if (!existing) throw new NotFoundError("Vehicle not found");

    if (patch.isDefault === true) {
      // Unset whatever is currently default — real safety against two
      // defaults existing at once comes from the partial unique index on
      // (user_id) WHERE is_default, not from this statement alone (see
      // db/schema.ts). This just makes the common case a clean swap instead
      // of relying on the constraint to reject it every time.
      await tx
        .update(vehicles)
        .set({ isDefault: false })
        .where(and(eq(vehicles.userId, userId), eq(vehicles.isDefault, true)));
    }

    const goingInactive = patch.status === "inactive";

    const [updated] = await tx
      .update(vehicles)
      .set({
        ...(patch.makeModel !== undefined ? { makeModel: patch.makeModel } : {}),
        ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        // Deactivating a vehicle that was the default clears the default flag —
        // an inactive vehicle sitting as "default" would be a confusing state.
        ...(goingInactive ? { isDefault: false } : {}),
      })
      .where(eq(vehicles.id, vehicleId))
      .returning();

    if (!updated) throw new NotFoundError("Vehicle not found");
    return updated;
  });
}

