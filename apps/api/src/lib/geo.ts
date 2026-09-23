import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * All PostGIS SQL lives here, never inline in services (non-negotiable rule 7
 * — geo queries use PostGIS functions with GIST indexes, never hand-rolled
 * haversine math). Drizzle has no native `geography` column type, so writes
 * and reads both go through raw `sql` fragments rather than the typed
 * insert/select API for these specific columns — see the `geography`
 * customType in db/schema.ts and its comment.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

/** WGS84 lat/lng validity — cheap sanity check before it ever reaches Postgres. */
export function isValidLatLng(point: LatLng): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

/** Builds a `geography(Point,4326)` value for use in an insert/update `.values()`/`.set()` call. */
export function geoPoint(point: LatLng): SQL {
  return sql`ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography`;
}

/** Select-list fragments to pull lat/lng back out of a geography column, aliased. */
export function selectLatLng(column: PgColumn, aliasPrefix: string) {
  return {
    [`${aliasPrefix}Lat`]: sql<number>`ST_Y(${column}::geometry)`,
    [`${aliasPrefix}Lng`]: sql<number>`ST_X(${column}::geometry)`,
  } as Record<string, SQL<number>>;
}

/** `ST_DWithin` predicate — meters, using the geography type's built-in spheroid distance. */
export function withinMeters(column: PgColumn, point: LatLng, meters: number): SQL {
  return sql`ST_DWithin(${column}, ${geoPoint(point)}, ${meters})`;
}

/** `ST_Distance` in meters, for ordering/reporting rather than filtering. */
export function distanceMeters(column: PgColumn, point: LatLng): SQL<number> {
  return sql<number>`ST_Distance(${column}, ${geoPoint(point)})`;
}
