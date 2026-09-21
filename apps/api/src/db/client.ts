import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";
import * as schema from "./schema.js";

export const sqlClient = postgres(env.DATABASE_URL, {
  // Small pool: single EC2 instance, low-volume Sprint 1 traffic. Revisit
  // when Booking/Search land real concurrent load (tech-stack.md §10).
  max: 10,
});

export const db = drizzle(sqlClient, { schema });

export type Db = typeof db;
