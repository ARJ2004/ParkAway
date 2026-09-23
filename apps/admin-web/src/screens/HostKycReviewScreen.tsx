import { Badge, Button, Card, InlineBanner, TextField } from "@parkaway/ui-web";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { approveKyc, getDocumentDownloadUrl, getHostKyc, rejectKyc, revealPayout } from "../api/hosts";
import { AdminShell } from "../components/AdminShell";
import { getRole } from "../session";
import styles from "./HostKycReviewScreen.module.css";

const KYC_BADGE: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  not_started: { label: "Not started", variant: "neutral" },
  submitted: { label: "In review", variant: "warning" },
  verified: { label: "Verified", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
};

/**
 * `platform_admin`-only actions (KYC approve/reject, document download,
 * payout reveal) — `support` sees this same screen read-only, matching
 * O-1: moderation and private documents are platform_admin-only. Every
 * document download and payout reveal is server-side audited before the
 * URL/number is ever returned (AC-8, AC-9).
 */
export function HostKycReviewScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getRole();
  const isPlatformAdmin = role === "platform_admin";

  const { data } = useQuery({ queryKey: ["hostKyc", id], queryFn: () => getHostKyc(id!), enabled: !!id });
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [revealReason, setRevealReason] = useState("");
  const [revealed, setRevealed] = useState<Awaited<ReturnType<typeof revealPayout>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approveMutation = useMutation({
    mutationFn: () => approveKyc(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hostKyc", id] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not approve KYC."),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectKyc(id!, rejectReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostKyc", id] });
      setShowRejectForm(false);
      setRejectReason("");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not reject KYC."),
  });

  const revealMutation = useMutation({
    mutationFn: () => revealPayout(id!, revealReason),
    onSuccess: (result) => {
      setRevealed(result);
      setRevealReason("");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not reveal payout account."),
  });

  async function handleViewDocument(documentId: string) {
    setError(null);
    try {
      const { url } = await getDocumentDownloadUrl(documentId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not open this document.");
    }
  }

  if (!data) return null;
  const { profile, documents } = data;
  const badge = KYC_BADGE[profile.kycStatus] ?? KYC_BADGE.not_started!;

  return (
    <AdminShell>
      <div className={styles.page}>
        <button type="button" className={styles.backLink} onClick={() => navigate(-1)}>
          ← Back
        </button>
        {error && <InlineBanner variant="danger">{error}</InlineBanner>}

        <div className={styles.headerRow}>
          <h1>{profile.legalName}</h1>
          <Badge label={badge.label} variant={badge.variant} />
        </div>

        <Card>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Host type</span>
            <span>{profile.hostType}</span>
          </div>
          {profile.businessName && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Business name</span>
              <span>{profile.businessName}</span>
            </div>
          )}
          {profile.kycRejectionReason && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Last rejection reason</span>
              <span>{profile.kycRejectionReason}</span>
            </div>
          )}
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Documents</h3>
          {documents.length === 0 && <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>No documents uploaded yet.</p>}
          {documents.map((doc) => (
            <div key={doc.id} className={styles.docRow}>
              <span>
                {doc.docType} <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>({doc.reviewStatus})</span>
              </span>
              {isPlatformAdmin ? (
                <Button size="sm" variant="secondary" onClick={() => handleViewDocument(doc.id)}>
                  View
                </Button>
              ) : (
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>platform_admin only</span>
              )}
            </div>
          ))}
        </Card>

        {isPlatformAdmin && profile.kycStatus === "submitted" && (
          <Card>
            <div className={styles.actionsRow}>
              <Button onClick={() => approveMutation.mutate()} loading={approveMutation.isPending}>
                Approve KYC
              </Button>
              <Button variant="danger" onClick={() => setShowRejectForm(true)}>
                Reject KYC
              </Button>
            </div>
            {showRejectForm && (
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <TextField label="Rejection reason (required)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                <div className={styles.actionsRow}>
                  <Button variant="secondary" onClick={() => setShowRejectForm(false)}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={() => rejectMutation.mutate()} loading={rejectMutation.isPending} disabled={!rejectReason.trim()}>
                    Confirm reject
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {isPlatformAdmin && (
          <Card>
            <h3 style={{ marginTop: 0 }}>Payout account</h3>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              {profile.payoutAccountLast4 ? `On file, ending in ${profile.payoutAccountLast4} (${profile.payoutBankName ?? "bank not set"}).` : "No payout account on file."}
            </p>
            {profile.payoutAccountLast4 && !revealed && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <TextField label="Reason for reveal (required, audited)" value={revealReason} onChange={(e) => setRevealReason(e.target.value)} />
                <Button variant="danger" onClick={() => revealMutation.mutate()} loading={revealMutation.isPending} disabled={!revealReason.trim()} style={{ alignSelf: "flex-start" }}>
                  Reveal full account number
                </Button>
              </div>
            )}
            {revealed && (
              <div className={styles.revealBox}>
                {revealed.accountHolderName} · {revealed.bankName} · {revealed.ifsc}
                <br />
                {revealed.accountNumber}
              </div>
            )}
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
