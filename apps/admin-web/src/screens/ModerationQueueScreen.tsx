import { Badge, Button, DetailPanel, EmptyState, InlineBanner, Select, Tabs, TextField } from "@parkaway/ui-web";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { approveListing, getModerationDetail, listModerationQueue, rejectListing, suspendListing } from "../api/listings";
import { AdminShell } from "../components/AdminShell";
import { getRole } from "../session";
import styles from "./ModerationQueueScreen.module.css";

const STATUS_TABS = [
  { value: "pending_verification", label: "In review" },
  { value: "published", label: "Published" },
  { value: "suspended", label: "Suspended" },
];

const REJECT_REASONS = [
  { value: "poor_photos", label: "Poor photos" },
  { value: "incomplete_info", label: "Incomplete info" },
  { value: "location_mismatch", label: "Location mismatch" },
  { value: "duplicate_listing", label: "Duplicate listing" },
  { value: "policy_violation", label: "Policy violation" },
  { value: "other", label: "Other" },
];

const SUSPEND_REASONS = [
  { value: "authorization_issue", label: "Authorization issue" },
  { value: "complaint", label: "Complaint" },
  { value: "safety_concern", label: "Safety concern" },
  { value: "fraud_suspected", label: "Fraud suspected" },
  { value: "host_request", label: "Host request" },
  { value: "other", label: "Other" },
];

/**
 * Queue row → right-hand detail panel, no page navigation — a moderator
 * processes items in sequence and losing list position is the single most
 * annoying thing this screen could do (§2's UX flow). `support` sees the
 * queue with PII masked but no action buttons — not present-but-erroring.
 */
export function ModerationQueueScreen() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const role = getRole();
  const isPlatformAdmin = role === "platform_admin";
  const [status, setStatus] = useState("pending_verification");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ["moderationQueue", status], queryFn: () => listModerationQueue(status) });
  const items = data?.listings ?? [];

  const { data: detail } = useQuery({
    queryKey: ["moderationDetail", selectedId],
    queryFn: () => getModerationDetail(selectedId!),
    enabled: !!selectedId,
  });

  function invalidateAfterAction() {
    queryClient.invalidateQueries({ queryKey: ["moderationQueue"] });
    queryClient.invalidateQueries({ queryKey: ["moderationDetail", selectedId] });
  }

  const approveMutation = useMutation({
    mutationFn: (level: number) => approveListing(selectedId!, level, "looks_good"),
    onSuccess: () => {
      setActionError(null);
      invalidateAfterAction();
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : "Could not approve this listing."),
  });

  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]!.value);
  const [rejectNote, setRejectNote] = useState("");
  const rejectMutation = useMutation({
    mutationFn: () => rejectListing(selectedId!, rejectReason, rejectNote || undefined),
    onSuccess: () => {
      setActionError(null);
      setRejectNote("");
      invalidateAfterAction();
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : "Could not reject this listing."),
  });

  const [suspendReason, setSuspendReason] = useState(SUSPEND_REASONS[0]!.value);
  const [suspendNote, setSuspendNote] = useState("");
  const suspendMutation = useMutation({
    mutationFn: () => suspendListing(selectedId!, suspendReason, suspendNote || undefined),
    onSuccess: () => {
      setActionError(null);
      setSuspendNote("");
      invalidateAfterAction();
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : "Could not suspend this listing."),
  });

  return (
    <AdminShell>
      <div className={styles.page}>
        <h1>Listing moderation</h1>
        <Tabs
          tabs={STATUS_TABS}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setSelectedId(null);
          }}
        />

        <DetailPanel
          list={
            items.length === 0 ? (
              <EmptyState title="Nothing here" description={`No listings are currently ${STATUS_TABS.find((t) => t.value === status)?.label.toLowerCase()}.`} />
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={[styles.row, item.id === selectedId ? styles.rowActive : ""].join(" ")}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div>
                    <div className={styles.rowTitle}>{item.spaceLabel}</div>
                    <div className={styles.rowSub}>{item.hostLegalName ?? "Host"}</div>
                  </div>
                  {item.hostKycStatus && <Badge label={item.hostKycStatus.replace("_", " ")} variant="neutral" />}
                </button>
              ))
            )
          }
          detail={
            selectedId && detail ? (
              <div>
                {actionError && <InlineBanner variant="danger">{actionError}</InlineBanner>}
                <h2 style={{ marginTop: 0 }}>{detail.listing.spaceLabel}</h2>

                {detail.photos.length > 0 && (
                  <div className={styles.photoStrip}>
                    {detail.photos.map((p) => (
                      <img key={p.id} src={p.url} alt="" className={styles.photoThumb} />
                    ))}
                  </div>
                )}

                <div className={styles.detailSection}>
                  <div className={styles.detailLabel}>Property</div>
                  {detail.property ? (
                    <div>
                      {detail.property.name} ({detail.property.propertyType}) — {detail.property.addressLine1}, {detail.property.locality}
                      <br />
                      Outsider policy: <strong>{detail.property.outsiderPolicy}</strong>
                    </div>
                  ) : (
                    "—"
                  )}
                </div>

                <div className={styles.detailSection}>
                  <div className={styles.detailLabel}>Authorization</div>
                  {detail.authorization ? (
                    <Badge label={detail.authorization.revokedAt ? "Revoked" : "Active"} variant={detail.authorization.revokedAt ? "danger" : "success"} />
                  ) : (
                    <Badge label="Not authorized" variant="neutral" />
                  )}
                  <span style={{ marginLeft: "8px", fontSize: "13px", color: "var(--color-text-secondary)" }}>Level required to publish: {detail.requiredLevel}</span>
                </div>

                <div className={styles.detailSection}>
                  <div className={styles.detailLabel}>Host</div>
                  {detail.host ? (
                    <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {detail.host.legalName} — KYC: {detail.host.kycStatus}
                      {isPlatformAdmin && detail.host.id && (
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/hosts/${detail.host!.id}/kyc`)}>
                          Review KYC
                        </Button>
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </div>

                <div className={styles.detailSection}>
                  <div className={styles.detailLabel}>Declared attributes</div>
                  {detail.listing.vehicleTypes?.join(", ") ?? "—"} · {detail.listing.lengthCm}×{detail.listing.widthCm}×{detail.listing.heightCm}cm ·{" "}
                  {detail.listing.covered ? "Covered" : "Uncovered"} · Access: {detail.listing.accessMethod ?? "—"}
                </div>

                <div className={styles.detailSection}>
                  <div className={styles.detailLabel}>Pricing</div>
                  {detail.pricing.length > 0 ? detail.pricing.map((r) => `${r.ruleType}: ₹${(r.amountPaise / 100).toFixed(0)}`).join(", ") : "Not set"}
                </div>

                {isPlatformAdmin && detail.listing.status === "pending_verification" && (
                  <div className={styles.actionsBar}>
                    <div className={styles.actionRow}>
                      <Button onClick={() => approveMutation.mutate(detail.requiredLevel)} loading={approveMutation.isPending}>
                        Approve at level {detail.requiredLevel}
                      </Button>
                    </div>
                    <div className={styles.actionRow}>
                      <Select options={REJECT_REASONS} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                      <TextField placeholder="Note (optional)" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
                      <Button variant="danger" onClick={() => rejectMutation.mutate()} loading={rejectMutation.isPending}>
                        Reject
                      </Button>
                    </div>
                  </div>
                )}

                {isPlatformAdmin && detail.listing.status === "published" && (
                  <div className={styles.actionsBar}>
                    <div className={styles.actionRow}>
                      <Select options={SUSPEND_REASONS} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} />
                      <TextField placeholder="Note (optional)" value={suspendNote} onChange={(e) => setSuspendNote(e.target.value)} />
                      <Button variant="danger" onClick={() => suspendMutation.mutate()} loading={suspendMutation.isPending}>
                        Suspend
                      </Button>
                    </div>
                  </div>
                )}

                {!isPlatformAdmin && (
                  <p style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Moderation actions require the platform_admin role.</p>
                )}
              </div>
            ) : null
          }
        />
      </div>
    </AdminShell>
  );
}
