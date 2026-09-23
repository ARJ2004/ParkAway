import { apiRequest } from "./client";
import type { LatLng } from "./properties";

export interface GeocodeResult {
  point: LatLng;
  formattedAddress: string;
}

export function geocode(address: string): Promise<GeocodeResult | null> {
  return apiRequest(`/v1/geocode?address=${encodeURIComponent(address)}`);
}

export function reverseGeocode(point: LatLng): Promise<GeocodeResult | null> {
  return apiRequest(`/v1/reverse-geocode?lat=${point.lat}&lng=${point.lng}`);
}
