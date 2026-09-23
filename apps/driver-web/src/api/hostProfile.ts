import { apiRequest } from "./client";

export interface HostProfile {
  id: string;
  userId: string;
  hostType: string;
  legalName: string;
  businessName: string | null;
  gstin: string | null;
  kycStatus: "not_started" | "submitted" | "verified" | "rejected";
  kycReviewedBy: string | null;
  kycReviewedAt: string | null;
  kycRejectionReason: string | null;
  payoutAccountName: string | null;
  payoutBankName: string | null;
  payoutIfsc: string | null;
  payoutAccountLast4: string | null;
  payoutAddedAt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHostProfileInput {
  hostType: string;
  legalName: string;
  businessName?: string;
  gstin?: string;
}

export function getHostProfile(): Promise<HostProfile> {
  return apiRequest("/v1/host/profile");
}

export function createHostProfile(input: CreateHostProfileInput): Promise<HostProfile> {
  return apiRequest("/v1/host/profile", { method: "POST", body: input });
}

export function submitKyc(): Promise<HostProfile> {
  return apiRequest("/v1/host/profile/kyc/submit", { method: "POST" });
}

export interface SetPayoutInput {
  accountHolderName: string;
  bankName: string;
  ifsc: string;
  accountNumber: string;
}

export function setPayoutDetails(input: SetPayoutInput): Promise<{ last4: string; ifsc: string; bankName: string }> {
  return apiRequest("/v1/host/profile/payout", { method: "PUT", body: input });
}

export interface RequestDocumentUploadInput {
  docType: string;
  contentType: string;
  byteSize: number;
  ownerType?: "host_profile" | "property";
  ownerId?: string;
}

export interface RequestedUploadResponse {
  documentId: string;
  uploadUrl: string;
  storageKey: string;
  expiresIn: number;
  requiredHeaders: Record<string, string>;
}

export function requestDocumentUploadUrl(input: RequestDocumentUploadInput): Promise<RequestedUploadResponse> {
  return apiRequest("/v1/host/documents/upload-url", { method: "POST", body: input });
}

export function completeDocumentUpload(documentId: string): Promise<unknown> {
  return apiRequest(`/v1/host/documents/${documentId}/complete`, { method: "POST" });
}
