import { apiRequest } from "./client";

export interface ModerationQueueItem {
  id: string;
  spaceLabel: string;
  status: string;
  propertyId: string;
  hostUserId: string;
  createdAt: string;
  hostLegalName: string | null;
  hostKycStatus: string | null;
}

export function listModerationQueue(status: string, propertyId?: string): Promise<{ listings: ModerationQueueItem[] }> {
  const params = new URLSearchParams({ status, ...(propertyId ? { propertyId } : {}) });
  return apiRequest(`/v1/admin/listings?${params.toString()}`);
}

export interface ModerationDetail {
  listing: {
    id: string;
    spaceLabel: string;
    status: string;
    statusReason: string | null;
    propertyId: string;
    hostUserId: string;
    vehicleTypes: string[] | null;
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
    covered: boolean;
    accessMethod: string | null;
    locationLat?: number;
    locationLng?: number;
  };
  property: { id: string; name: string; propertyType: string; addressLine1: string; locality: string; city: string; outsiderPolicy: string } | null;
  authorization: { id: string; authorizationType: string; expiresAt: string | null; revokedAt: string | null } | null;
  host: { legalName: string; kycStatus: string; hostType: string; id?: string } | null;
  photos: Array<{ id: string; url: string; isCover: boolean; position: number }>;
  verifications: Array<{ id: string; level: number; method: string; verifiedAt: string; expiresAt: string | null; revokedAt: string | null }>;
  pricing: Array<{ ruleType: string; amountPaise: number }>;
  requiredLevel: number;
}

export function getModerationDetail(id: string): Promise<ModerationDetail> {
  return apiRequest(`/v1/admin/listings/${id}`);
}

export function approveListing(id: string, level: number, reasonCategory: string, note?: string): Promise<unknown> {
  return apiRequest(`/v1/admin/listings/${id}/approve`, { method: "POST", body: { level, reasonCategory, note } });
}

export function rejectListing(id: string, reasonCategory: string, note?: string): Promise<unknown> {
  return apiRequest(`/v1/admin/listings/${id}/reject`, { method: "POST", body: { reasonCategory, note } });
}

export function suspendListing(id: string, reasonCategory: string, note?: string): Promise<unknown> {
  return apiRequest(`/v1/admin/listings/${id}/suspend`, { method: "POST", body: { reasonCategory, note } });
}
