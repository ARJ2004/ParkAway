import { Badge, Button, Card, InlineBanner, Modal, Select, Tabs, TextField, TimeRangeField, Toggle, type TimeRangeValue } from "@parkaway/ui-web";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import {
  getAccessPolicy,
  getCurrentAuthorization,
  getProperty,
  grantAuthorization,
  revokeAuthorization,
  addAccessPolicyVersion,
} from "../../api/properties";
import { PropertyManagerShell, type ActiveProperty } from "../../components/PropertyManagerShell";
import styles from "./ManagePropertyDetailScreen.module.css";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "authorization", label: "Authorization" },
  { value: "access-policy", label: "Access policy" },
];

const AUTHORIZATION_TYPES = [
  { value: "society_resolution", label: "Society resolution" },
  { value: "management_contract", label: "Management contract" },
];

const ACCESS_METHODS = ["qr", "guard_manual", "boom_barrier"];

function deriveAuthState(authorization: Awaited<ReturnType<typeof getCurrentAuthorization>>): ActiveProperty["authorizationState"] {
  if (!authorization) return "none";
  if (authorization.revokedAt) return "revoked";
  if (authorization.expiresAt) {
    const expiresAt = new Date(authorization.expiresAt).getTime();
    if (expiresAt <= Date.now()) return "expired";
    if (expiresAt - Date.now() < 14 * 24 * 60 * 60 * 1000) return "expiring";
  }
  return "active";
}

export function ManagePropertyDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");

  const { data: property } = useQuery({ queryKey: ["property", id], queryFn: () => getProperty(id!), enabled: !!id });
  const { data: authorization } = useQuery({ queryKey: ["authorization", id], queryFn: () => getCurrentAuthorization(id!), enabled: !!id });

  if (!property) return null;

  const activeProperty: ActiveProperty = { name: property.name, authorizationState: deriveAuthState(authorization ?? null) };

  return (
    <PropertyManagerShell activeProperty={activeProperty}>
      <button type="button" onClick={() => navigate("/manage")} style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", alignSelf: "flex-start" }}>
        ← All properties
      </button>
      <h1>{property.name}</h1>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "overview" && <OverviewTab property={property} />}
      {tab === "authorization" && <AuthorizationTab propertyId={id!} authorization={authorization ?? null} />}
      {tab === "access-policy" && <AccessPolicyTab propertyId={id!} />}
    </PropertyManagerShell>
  );
}

function OverviewTab({ property }: { property: Awaited<ReturnType<typeof getProperty>> }) {
  return (
    <Card>
      <div className={styles.form}>
        <Row label="Type" value={property.propertyType} />
        <Row label="Address" value={`${property.addressLine1}, ${property.locality}, ${property.city}, ${property.state} ${property.pincode}`} />
        <Row label="Outsider policy" value={property.outsiderPolicy} />
        {property.locationLat !== undefined && <Row label="Coordinates" value={`${property.locationLat!.toFixed(5)}, ${property.locationLng!.toFixed(5)}`} />}
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--color-text-secondary)", fontSize: "13px" }}>{label}</span>
      <span style={{ textTransform: "capitalize" }}>{value}</span>
    </div>
  );
}

const AUTH_STATE_COPY: Record<ActiveProperty["authorizationState"], { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  active: { label: "Active", variant: "success" },
  expiring: { label: "Expiring soon", variant: "warning" },
  expired: { label: "Expired", variant: "danger" },
  revoked: { label: "Revoked", variant: "danger" },
  none: { label: "Not authorized", variant: "neutral" },
};

function AuthorizationTab({ propertyId, authorization }: { propertyId: string; authorization: Awaited<ReturnType<typeof getCurrentAuthorization>> }) {
  const queryClient = useQueryClient();
  const state = deriveAuthState(authorization);
  const [showGrantForm, setShowGrantForm] = useState(!authorization);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [authType, setAuthType] = useState(AUTHORIZATION_TYPES[0]!.value);
  const [permitHourly, setPermitHourly] = useState(true);
  const [permitDaily, setPermitDaily] = useState(true);
  const [outsidersAllowed, setOutsidersAllowed] = useState(false);

  const grantMutation = useMutation({
    mutationFn: () =>
      grantAuthorization(propertyId, {
        authorizationType: authType,
        permittedParkingTypes: [...(permitHourly ? ["hourly"] : []), ...(permitDaily ? ["daily"] : [])],
        outsiderPolicy: outsidersAllowed ? "allowed" : "authorized_only",
        effectiveFrom: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authorization", propertyId] });
      setShowGrantForm(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not grant authorization."),
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokeAuthorization(propertyId, authorization!.id, revokeReason),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["authorization", propertyId] });
      setShowRevokeModal(false);
      setRevokeReason("");
      setError(`Revoked — ${result.suspendedListingCount} published listing(s) suspended.`);
    },
  });

  return (
    <div className={styles.form}>
      {error && <InlineBanner variant={error.startsWith("Revoked") ? "success" : "danger"}>{error}</InlineBanner>}

      <Card>
        <div className={styles.authStateBlock}>
          <div className={styles.authStateText}>
            <span className={styles.authStateLabel}>{AUTH_STATE_COPY[state].label}</span>
            {authorization && <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Type: {authorization.authorizationType}</span>}
          </div>
          <Badge label={AUTH_STATE_COPY[state].label} variant={AUTH_STATE_COPY[state].variant} />
        </div>
        <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
          {(!authorization || authorization.revokedAt) && <Button onClick={() => setShowGrantForm(true)}>Grant authorization</Button>}
          {authorization && !authorization.revokedAt && (
            <Button variant="danger" onClick={() => setShowRevokeModal(true)}>
              Revoke
            </Button>
          )}
        </div>
      </Card>

      {showGrantForm && (
        <Card>
          <h3 style={{ marginTop: 0 }}>Grant authorization</h3>
          <div className={styles.form}>
            <Select label="Basis" options={AUTHORIZATION_TYPES} value={authType} onChange={(e) => setAuthType(e.target.value)} />
            <Toggle label="Hourly parking permitted" checked={permitHourly} onChange={setPermitHourly} />
            <Toggle label="Daily parking permitted" checked={permitDaily} onChange={setPermitDaily} />
            <Toggle label="Allow outsiders (non-residents/tenants) to book" checked={outsidersAllowed} onChange={setOutsidersAllowed} />
            <Button onClick={() => grantMutation.mutate()} loading={grantMutation.isPending} disabled={!permitHourly && !permitDaily} style={{ alignSelf: "flex-start" }}>
              Grant
            </Button>
          </div>
        </Card>
      )}

      <Modal open={showRevokeModal} onClose={() => setShowRevokeModal(false)} title="Revoke authorization">
        <p>This will immediately suspend every published listing in this property. This cannot be undone.</p>
        <TextField label="Reason (required)" value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} />
        <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
          <Button variant="secondary" onClick={() => setShowRevokeModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => revokeMutation.mutate()} loading={revokeMutation.isPending} disabled={!revokeReason.trim()}>
            Revoke authorization
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function AccessPolicyTab({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const { data: policy } = useQuery({ queryKey: ["accessPolicy", propertyId], queryFn: () => getAccessPolicy(propertyId) });
  const [range, setRange] = useState<TimeRangeValue>({ daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startMin: 0, endMin: 1439 });
  const [accessMethods, setAccessMethods] = useState<string[]>(["guard_manual"]);
  const [escortRequired, setEscortRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      addAccessPolicyVersion(propertyId, {
        gateHours: range.daysOfWeek.length === 7 && range.startMin === 0 && range.endMin === 1439 ? { always: true } : [{ dow: range.daysOfWeek[0] ?? 0, opens: String(range.startMin), closes: String(range.endMin) }],
        accessMethods,
        escortRequired,
        effectiveFrom: new Date().toISOString(),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accessPolicy", propertyId] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save access policy."),
  });

  function toggleMethod(method: string) {
    setAccessMethods((prev) => (prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]));
  }

  return (
    <div className={styles.form}>
      {error && <InlineBanner variant="danger">{error}</InlineBanner>}
      {policy && (
        <Card>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-secondary)" }}>Current version: v{policy.version}</p>
        </Card>
      )}
      <Card>
        <h3 style={{ marginTop: 0 }}>New access policy version</h3>
        <p style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Versions are append-only — saving adds a new one, it never edits the current one in place.</p>
        <div className={styles.form}>
          <TimeRangeField label="Gate hours" value={range} onChange={setRange} />
          <div>
            <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Access methods</span>
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              {ACCESS_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMethod(m)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "999px",
                    border: "1px solid var(--color-border-strong)",
                    background: accessMethods.includes(m) ? "var(--color-accent)" : "var(--color-surface)",
                    color: accessMethods.includes(m) ? "var(--color-accent-contrast)" : "var(--color-text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  {m.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          <Toggle label="Escort required" checked={escortRequired} onChange={setEscortRequired} />
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={accessMethods.length === 0} style={{ alignSelf: "flex-start" }}>
            Save new version
          </Button>
        </div>
      </Card>
    </div>
  );
}
