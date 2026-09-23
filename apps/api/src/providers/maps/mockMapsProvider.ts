import type { LatLng } from "../../lib/geo.js";
import type { GeocodeResult, MapsProvider } from "./types.js";

/**
 * Fixed coordinates for seeded pilot addresses — nothing in CI/local dev
 * needs a Mapbox key. Structurally blocked from running in production: see
 * the boot guard in env.ts, which refuses to start the process at all if
 * MAPS_PROVIDER=mock while NODE_ENV=production.
 */
const SEEDED_ADDRESSES: Record<string, GeocodeResult> = {
  "koramangala 5th block, bengaluru": {
    point: { lat: 12.9352, lng: 77.6146 },
    formattedAddress: "Koramangala 5th Block, Bengaluru, Karnataka, India",
  },
  "indiranagar 100 feet road, bengaluru": {
    point: { lat: 12.9719, lng: 77.6412 },
    formattedAddress: "100 Feet Road, Indiranagar, Bengaluru, Karnataka, India",
  },
  "hsr layout sector 2, bengaluru": {
    point: { lat: 12.9116, lng: 77.6389 },
    formattedAddress: "HSR Layout Sector 2, Bengaluru, Karnataka, India",
  },
};

const FALLBACK: GeocodeResult = {
  point: { lat: 12.9716, lng: 77.5946 }, // Bengaluru city centre
  formattedAddress: "Bengaluru, Karnataka, India (mock geocode — address not in seeded fixture list)",
};

export class MockMapsProvider implements MapsProvider {
  async geocode(address: string): Promise<GeocodeResult | null> {
    const key = address.trim().toLowerCase();
    return SEEDED_ADDRESSES[key] ?? FALLBACK;
  }

  async reverseGeocode(point: LatLng): Promise<GeocodeResult | null> {
    return { point, formattedAddress: `Mock address near ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}` };
  }

  staticMapUrl(point: LatLng): string {
    return `https://mock-maps.parkaway.local/static?lat=${point.lat}&lng=${point.lng}`;
  }
}
