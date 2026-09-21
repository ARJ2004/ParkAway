import { Button, Card, InlineBanner, TextField } from "@parkaway/ui-web";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../api/client";
import { getProfile, updateProfile } from "../api/profile";
import { AppShell } from "../components/AppShell";

export function ProfileScreen() {
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: getProfile });

  // Undefined = "not yet edited this session" -> falls back to the server
  // value below. A real string once the user types, taking over from there.
  // This avoids the classic "copy a prop/query result into state via an
  // effect" anti-pattern (react-hooks/set-state-in-effect) entirely, rather
  // than suppressing the lint rule.
  const [name, setName] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameValue = name ?? profile?.name ?? "";
  const emailValue = email ?? profile?.email ?? "";

  const mutation = useMutation({
    mutationFn: () => updateProfile({ name: nameValue, email: emailValue }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile"], updated);
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not save your changes.");
    },
  });

  if (!profile) return null;

  return (
    <AppShell>
      <h1>Profile</h1>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && <InlineBanner variant="danger">{error}</InlineBanner>}
          {saved && <InlineBanner variant="success">Saved.</InlineBanner>}
          {/*
            Phone is read-only with no edit affordance at all — deliberate,
            not an oversight. It matches the backend's hard rejection of
            phone-field updates (it's the verified identity anchor).
          */}
          <TextField label="Mobile number" value={profile.phone} readOnly badge="Verified" />
          <TextField label="Name" value={nameValue} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          <TextField
            label="Email"
            type="email"
            value={emailValue}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} style={{ alignSelf: "flex-start" }}>
            Save changes
          </Button>
        </div>
      </Card>
    </AppShell>
  );
}
