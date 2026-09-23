import type { LatLng } from "../../lib/geo.js";

/**
 * Every maps/geocoding call goes through this interface — no screen imports
 * `mapbox-gl`/`@rnmapbox/maps` and no service calls the Mapbox API directly
 * (tech-stack.md §8, non-negotiable rule #4). Sprint 2 needs only
 * reverse-geocode-on-pin-drop and a forward-geocode hint on the address
 * field; `SRCH-01`'s real destination search is Sprint 3 — building the
 * boundary now means that sprint adds a method to an existing adapter
 * instead of retrofitting one.
 */
export interface GeocodeResult {
  point: LatLng;
  formattedAddress: string;
}

export interface MapsProvider {
  geocode(address: string): Promise<GeocodeResult | null>;
  reverseGeocode(point: LatLng): Promise<GeocodeResult | null>;
  staticMapUrl(point: LatLng, opts?: { zoom?: number; width?: number; height?: number }): string;
}
