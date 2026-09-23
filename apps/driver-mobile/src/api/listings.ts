import { apiRequest } from "./client";
import type { LatLng } from "./properties";

export type { LatLng } from "./properties";

export interface Listing {
  id: string;
  propertyId: string;
  hostUserId: string;
  spaceLabel: string;
  spaceType: string;
  capacity: number;
  vehicleTypes: string[] | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  covered: boolean;
  amenities: { evCharging?: boolean; cctv?: boolean; guarded?: boolean; open24x7?: boolean } | null;
  accessMethod: string | null;
  rules: string | null;
  status: string;
  statusReason: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  locationLat?: number;
  locationLng?: number;
}

export interface CreateListingInput {
  propertyId: string;
  spaceLabel: string;
  spaceType?: string;
  capacity?: number;
}

export function listOwnListings(): Promise<{ listings: Listing[] }> {
  return apiRequest("/v1/host/listings");
}

export function getListing(id: string): Promise<Listing> {
  return apiRequest(`/v1/host/listings/${id}`);
}

export function createListing(input: CreateListingInput): Promise<Listing> {
  return apiRequest("/v1/host/listings", { method: "POST", body: input });
}

export interface UpdateListingInput {
  spaceLabel?: string;
  vehicleTypes?: string[];
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  covered?: boolean;
  amenities?: { evCharging?: boolean; cctv?: boolean; guarded?: boolean; open24x7?: boolean };
  accessMethod?: string;
  rules?: string;
  location?: LatLng;
}

export function updateListing(id: string, patch: UpdateListingInput): Promise<Listing> {
  return apiRequest(`/v1/host/listings/${id}`, { method: "PATCH", body: patch });
}

export interface ListingPhoto {
  id: string;
  listingId: string;
  storageKey: string;
  url: string;
  position: number;
  isCover: boolean;
  completedAt: string | null;
  createdAt: string;
}

export function listListingPhotos(listingId: string): Promise<{ photos: ListingPhoto[] }> {
  return apiRequest(`/v1/host/listings/${listingId}/photos`);
}

export function requestPhotoUploadUrl(listingId: string, contentType: string, byteSize: number) {
  return apiRequest<{ photoId: string; uploadUrl: string; storageKey: string; expiresIn: number; requiredHeaders: Record<string, string> }>(
    `/v1/host/listings/${listingId}/photos/upload-url`,
    { method: "POST", body: { contentType, byteSize } }
  );
}

export function completePhotoUpload(listingId: string, photoId: string): Promise<ListingPhoto> {
  return apiRequest(`/v1/host/listings/${listingId}/photos/${photoId}/complete`, { method: "POST" });
}

export function updatePhoto(listingId: string, photoId: string, patch: { position?: number; isCover?: boolean }): Promise<ListingPhoto> {
  return apiRequest(`/v1/host/listings/${listingId}/photos/${photoId}`, { method: "PATCH", body: patch });
}

export function deletePhoto(listingId: string, photoId: string): Promise<void> {
  return apiRequest(`/v1/host/listings/${listingId}/photos/${photoId}`, { method: "DELETE" });
}

export function submitListing(id: string): Promise<Listing> {
  return apiRequest(`/v1/host/listings/${id}/submit`, { method: "POST" });
}

export function pauseListing(id: string): Promise<Listing> {
  return apiRequest(`/v1/host/listings/${id}/pause`, { method: "POST" });
}

export function resumeListing(id: string): Promise<Listing> {
  return apiRequest(`/v1/host/listings/${id}/resume`, { method: "POST" });
}

export function archiveListing(id: string): Promise<Listing> {
  return apiRequest(`/v1/host/listings/${id}/archive`, { method: "POST" });
}
