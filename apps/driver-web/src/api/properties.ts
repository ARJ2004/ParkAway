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
  securityContacts: Array<{ name: string; phone: string; role: string }> | null;
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
  securityContacts?: Array<{ name: string; phone: string; role: string }>;
}

export function listProperties(): Promise<{ properties: Property[] }> {
  return apiRequest("/v1/properties");
}

export function getProperty(id: string): Promise<Property> {
  return apiRequest(`/v1/properties/${id}`);
}

export function createProperty(input: CreatePropertyInput): Promise<Property> {
  return apiRequest("/v1/properties", { method: "POST", body: input });
}

export function updateProperty(id: string, patch: Partial<CreatePropertyInput>): Promise<Property> {
  return apiRequest(`/v1/properties/${id}`, { method: "PATCH", body: patch });
}

export interface Authorization {
  id: string;
  propertyId: string;
  authorizedByUserId: string;
  authorizationType: string;
  permittedParkingTypes: string[];
  outsiderPolicy: string;
  documentId: string | null;
  effectiveFrom: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revokeReason: string | null;
  createdAt: string;
}

export interface GrantAuthorizationInput {
  authorizationType: string;
  permittedParkingTypes: string[];
  outsiderPolicy: string;
  effectiveFrom: string;
  expiresAt?: string;
  documentId?: string;
}

export function getCurrentAuthorization(propertyId: string): Promise<Authorization | null> {
  return apiRequest(`/v1/properties/${propertyId}/authorizations/current`);
}

export function grantAuthorization(propertyId: string, input: GrantAuthorizationInput): Promise<Authorization> {
  return apiRequest(`/v1/properties/${propertyId}/authorizations`, { method: "POST", body: input });
}

export function revokeAuthorization(propertyId: string, authorizationId: string, reason: string): Promise<{ suspendedListingCount: number }> {
  return apiRequest(`/v1/properties/${propertyId}/authorizations/${authorizationId}/revoke`, { method: "POST", body: { reason } });
}

export interface AccessPolicy {
  id: string;
  propertyId: string;
  version: number;
  gateHours: Array<{ dow: number; opens: string; closes: string }> | { always: true };
  accessMethods: string[];
  escortRequired: boolean;
  emergencyOverrideContact: { name: string; phone: string } | null;
  effectiveFrom: string;
  createdByUserId: string;
  createdAt: string;
}

export interface AccessPolicyInput {
  gateHours: Array<{ dow: number; opens: string; closes: string }> | { always: true };
  accessMethods: string[];
  escortRequired?: boolean;
  emergencyOverrideContact?: { name: string; phone: string } | null;
  effectiveFrom: string;
}

export function getAccessPolicy(propertyId: string): Promise<AccessPolicy | null> {
  return apiRequest(`/v1/properties/${propertyId}/access-policy`);
}

export function addAccessPolicyVersion(propertyId: string, input: AccessPolicyInput): Promise<AccessPolicy> {
  return apiRequest(`/v1/properties/${propertyId}/access-policy`, { method: "POST", body: input });
}
