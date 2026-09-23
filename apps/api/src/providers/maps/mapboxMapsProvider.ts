import { env } from "../../env.js";
import type { LatLng } from "../../lib/geo.js";
import type { GeocodeResult, MapsProvider } from "./types.js";

const GEOCODING_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";
const STATIC_BASE = "https://api.mapbox.com/styles/v1/mapbox/streets-v11/static";

export class MapboxMapsProvider implements MapsProvider {
  private readonly token: string;

  constructor() {
    if (!env.MAPBOX_TOKEN) {
      throw new Error("MAPS_PROVIDER=mapbox requires MAPBOX_TOKEN to be set (a server-side secret token, never the client's public token).");
    }
    this.token = env.MAPBOX_TOKEN;
  }

  async geocode(address: string): Promise<GeocodeResult | null> {
    const url = `${GEOCODING_BASE}/${encodeURIComponent(address)}.json?access_token=${this.token}&limit=1&country=IN`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Mapbox geocode failed: ${res.status}`);
    const body = (await res.json()) as { features?: Array<{ center: [number, number]; place_name: string }> };
    const feature = body.features?.[0];
    if (!feature) return null;
    return { point: { lng: feature.center[0], lat: feature.center[1] }, formattedAddress: feature.place_name };
  }

  async reverseGeocode(point: LatLng): Promise<GeocodeResult | null> {
    const url = `${GEOCODING_BASE}/${point.lng},${point.lat}.json?access_token=${this.token}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Mapbox reverse geocode failed: ${res.status}`);
    const body = (await res.json()) as { features?: Array<{ place_name: string }> };
    const feature = body.features?.[0];
    if (!feature) return null;
    return { point, formattedAddress: feature.place_name };
  }

  staticMapUrl(point: LatLng, opts: { zoom?: number; width?: number; height?: number } = {}): string {
    const { zoom = 15, width = 400, height = 300 } = opts;
    return `${STATIC_BASE}/pin-s+e8563a(${point.lng},${point.lat})/${point.lng},${point.lat},${zoom}/${width}x${height}?access_token=${this.token}`;
  }
}
