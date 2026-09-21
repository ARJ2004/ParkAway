import { Card } from "@parkaway/ui-web";
import { useQuery } from "@tanstack/react-query";
import { getProfile } from "../api/profile";
import { AppShell } from "../components/AppShell";

export function HomeScreen() {
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: getProfile });

  return (
    <AppShell>
      <h1>{profile?.name ? `Welcome back, ${profile.name}` : "Welcome back"}</h1>
      <Card>
        <p>
          Search and booking are on the way (Sprint 3) — this is where destination-aware search will live.
          For now, your account is ready: manage your profile and vehicles from the nav above.
        </p>
      </Card>
    </AppShell>
  );
}
