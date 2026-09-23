import { apiRequest } from "./client";

export interface HostProfileDetail {
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
  status: string;
}

export interface HostDocument {
  id: string;
  ownerType: string;
  ownerId: string;
  docType: string;
  contentType: string;
  reviewStatus: string;
  createdAt: string;
}

export function getHostKyc(hostProfileId: string): Promise<{ profile: HostProfileDetail; documents: HostDocument[] }> {
  return apiRequest(`/v1/admin/hosts/${hostProfileId}/kyc`);
}

export function approveKyc(hostProfileId: string): Promise<HostProfileDetail> {
  return apiRequest(`/v1/admin/hosts/${hostProfileId}/kyc/approve`, { method: "POST" });
}

export function rejectKyc(hostProfileId: string, reason: string): Promise<HostProfileDetail> {
  return apiRequest(`/v1/admin/hosts/${hostProfileId}/kyc/reject`, { method: "POST", body: { reason } });
}

export function getDocumentDownloadUrl(documentId: string): Promise<{ url: string; expiresIn: number }> {
  return apiRequest(`/v1/admin/documents/${documentId}/download-url`);
}

export function revealPayout(hostProfileId: string, reason: string): Promise<{ accountNumber: string; ifsc: string | null; bankName: string | null; accountHolderName: string | null }> {
  return apiRequest(`/v1/admin/hosts/${hostProfileId}/payout/reveal`, { method: "POST", body: { reason } });
}
