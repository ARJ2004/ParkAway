import { Button, Card, InlineBanner, TextField } from "@parkaway/ui-web";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../../api/client";
import { getHostProfile, setPayoutDetails } from "../../api/hostProfile";
import { OwnerAppShell } from "../../components/OwnerAppShell";

/** Deliberately last and skippable — payout is "so you can get paid", never a gate on listing work (§3's Group F UX flow). */
export function HostPayoutScreen() {
  const { data: profile } = useQuery({ queryKey: ["hostProfile"], queryFn: getHostProfile, retry: false });
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saved, setSaved] = useState<{ last4: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => setPayoutDetails({ accountHolderName, bankName, ifsc, accountNumber }),
    onSuccess: (result) => {
      setSaved(result);
      setError(null);
      setAccountNumber("");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save your payout details."),
  });

  const currentLast4 = saved?.last4 ?? profile?.payoutAccountLast4;

  return (
    <OwnerAppShell>
      <h1>Payout details</h1>
      {error && <InlineBanner variant="danger">{error}</InlineBanner>}
      {currentLast4 && <InlineBanner variant="success">Account on file, ending in {currentLast4}.</InlineBanner>}
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <TextField label="Account holder name" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} />
          <TextField label="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          <TextField label="IFSC" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="HDFC0001234" />
          <TextField label="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder={currentLast4 ? `•••• ${currentLast4}` : undefined} />
          <p style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
            Your account number is encrypted before storage and is never shown back to you or anyone else in full.
          </p>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!accountHolderName.trim() || !bankName.trim() || !ifsc.trim() || !accountNumber.trim()}
            style={{ alignSelf: "flex-start" }}
          >
            Save payout details
          </Button>
        </div>
      </Card>
    </OwnerAppShell>
  );
}
