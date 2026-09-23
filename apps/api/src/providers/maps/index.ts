import { env } from "../../env.js";
import { MapboxMapsProvider } from "./mapboxMapsProvider.js";
import { MockMapsProvider } from "./mockMapsProvider.js";
import type { MapsProvider } from "./types.js";

let cached: MapsProvider | undefined;

export function createMapsProvider(): MapsProvider {
  if (cached) return cached;
  cached = env.MAPS_PROVIDER === "mapbox" ? new MapboxMapsProvider() : new MockMapsProvider();
  return cached;
}

export type { GeocodeResult, MapsProvider } from "./types.js";
