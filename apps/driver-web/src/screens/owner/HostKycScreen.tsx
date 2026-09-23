import { Badge, Button, Card, FileUpload, InlineBanner, Select, TextField } from "@parkaway/ui-web";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../../api/client";
import { completeDocumentUpload, createHostProfile, getHostProfile, requestDocumentUploadUrl, submitKyc } from "../../api/hostProfile";
import { OwnerAppShell } from "../../components/OwnerAppShell";

const DOC_TYPES = [
  { value: "pan", label: "PAN card" },
  { value: "aadhaar", label: "Aadhaar" },
  { value: "ownership_proof", label: "Ownership / authorization proof" },
];

const KYC_LABEL: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  not_started: { label: "Not started", variant: "neutral" },
  submitted: { label: "In review", variant: "warning" },
  verified: { label: "Verified", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
};

/** AC-5: KYC gates payout, not publication — this screen is reachable and completable independently of listing work. */
export function HostKycScreen() {
  const queryClient = useQueryClient();
  const { data: profile, isError } = useQuery({ queryKey: ["hostProfile"], queryFn: getHostProfile, retry: false });
  const [legalName, setLegalName] = useState("");
  const [docType, setDocType] = useState(DOC_TYPES[0]!.value);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createHostProfile({ hostType: "individual", legalName }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hostProfile"] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create your host profile."),
  });

  const submitMutation = useMutation({
    mutationFn: submitKyc,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hostProfile"] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not submit for review."),
  });

  if (isError || !profile) {
    return (
      <OwnerAppShell>
        <h1>Verify your identity</h1>
        {error && <InlineBanner variant="danger">{error}</InlineBanner>}
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p>Create your host profile to start KYC — this doesn&apos;t block publishing a listing (AC-5).</p>
            <TextField label="Legal name (as on your ID)" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!legalName.trim()} style={{ alignSelf: "flex-start" }}>
              Start
            </Button>
          </div>
        </Card>
      </OwnerAppShell>
    );
  }

  const status = KYC_LABEL[profile.kycStatus] ?? KYC_LABEL.not_started!;

  return (
    <OwnerAppShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Verify your identity</h1>
        <Badge label={status.label} variant={status.variant} />
      </div>
      {error && <InlineBanner variant="danger">{error}</InlineBanner>}
      {profile.kycStatus === "rejected" && profile.kycRejectionReason && <InlineBanner variant="danger">{profile.kycRejectionReason}</InlineBanner>}

      {(profile.kycStatus === "not_started" || profile.kycStatus === "rejected") && (
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Select label="Document type" options={DOC_TYPES} value={docType} onChange={(e) => setDocType(e.target.value)} />
            <FileUpload
              label="Upload document"
              accept="image/jpeg,image/png,application/pdf"
              hint="A clear photo or scan — this goes straight to secure storage, never through our servers unencrypted."
              requestUploadUrl={async (file) => {
                const result = await requestDocumentUploadUrl({ docType, contentType: file.type, byteSize: file.size });
                return { uploadId: result.documentId, uploadUrl: result.uploadUrl, requiredHeaders: result.requiredHeaders };
              }}
              completeUpload={async (documentId) => {
                await completeDocumentUpload(documentId);
              }}
            />
            <Button onClick={() => submitMutation.mutate()} loading={submitMutation.isPending} style={{ alignSelf: "flex-start" }}>
              Submit for review
            </Button>
          </div>
        </Card>
      )}
      {profile.kycStatus === "submitted" && (
        <Card>
          <p>We&apos;re reviewing your documents — this usually takes 1-2 business days. You&apos;ll see the result here.</p>
        </Card>
      )}
      {profile.kycStatus === "verified" && (
        <Card>
          <p>You&apos;re verified — nothing else to do here. Add your payout details to get paid.</p>
        </Card>
      )}
    </OwnerAppShell>
  );
}
