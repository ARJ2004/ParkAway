import { apiRequest } from "./client";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Property {
  id: string;
  name: string;
  propertyType: string;
  addressLine1: string;
  addressLine2: string | null;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  outsiderPolicy: string;
  status: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  locationLat?: number;
  locationLng?: number;
  entryLocationLat?: number;
  entryLocationLng?: number;
  location?: LatLng;
  entryLocation?: LatLng;
}

export interface CreatePropertyInput {
  name: string;
  propertyType: string;
  addressLine1: string;
  addressLine2?: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  location: LatLng;
  entryLocation: LatLng;
  outsiderPolicy: string;
}

export function listProperties(): Promise<{ properties: Property[] }> {
  return apiRequest("/v1/properties");
}

export function createProperty(input: CreatePropertyInput): Promise<Property> {
  return apiRequest("/v1/properties", { method: "POST", body: input });
}
