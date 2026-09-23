import { Badge, Button, Card, InlineBanner, TextField, useTheme } from "@parkaway/ui-native";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { logout as apiLogout } from "../api/auth";
import { ApiError } from "../api/client";
import { getProfile, updateProfile, type Profile } from "../api/profile";
import { useAuth } from "../navigation/AuthContext";
import { clearSession, getRefreshToken } from "../session";

function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Avatar + name/phone header, grouped editable fields, sign-out as its own
 * clearly separated destructive row at the bottom — not a button buried in
 * a nav bar. Draws on the Affirm/Freenow/PayPal reference pattern (header
 * card, grouped settings, log-out last), restyled in ParkAway's palette.
 *
 * Shared across both `MainTabs` and `OwnerTabs` (deliberately not typed
 * against either tab navigator's param list) — a person's name and phone
 * don't change with their hat. Takes no navigation props; sign-out and the
 * persona switch both go through `AuthContext`, never a direct navigation call.
 */
export function ProfileScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { logout, activePersona, selectPersona } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getProfile().then(setProfile);
    }, [])
  );

  const nameValue = name ?? profile?.name ?? "";
  const emailValue = email ?? profile?.email ?? "";

  async function handleSave() {
    setError(null);
    setLoading(true);
    try {
      const updated = await updateProfile({ name: nameValue, email: emailValue });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your changes.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const refreshToken = await getRefreshToken();
    await clearSession();
    logout();
    if (refreshToken) {
      apiLogout(refreshToken).catch(() => {});
    }
  }

  async function handleSwitchPersona() {
    const next = activePersona === "owner" ? "driver" : "owner";
    setSwitching(true);
    try {
      await selectPersona(next);
    } finally {
      setSwitching(false);
    }
  }

  if (!profile) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
            <Text style={[styles.avatarText, { color: c.accent, fontFamily: theme.fonts.headingBold }]}>
              {initialsOf(profile.name)}
            </Text>
          </View>
          <View>
            <Text style={[styles.name, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
              {profile.name || "Add your name"}
            </Text>
            <View style={styles.phoneRow}>
              <Text style={[styles.phone, { color: c.textSecondary, fontFamily: theme.fonts.body }]}>{profile.phone}</Text>
              <Badge label="Verified" variant="success" />
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: c.textMuted, fontFamily: theme.fonts.bodyMedium }]}>
          Personal details
        </Text>
        <Card style={styles.card}>
          {error && <InlineBanner variant="danger">{error}</InlineBanner>}
          {saved && <InlineBanner variant="success">Saved.</InlineBanner>}
          <TextField label="Name" value={nameValue} onChangeText={setName} placeholder="Your name" />
          <TextField
            label="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={emailValue}
            onChangeText={setEmail}
            placeholder="you@example.com"
          />
          <Button onPress={handleSave} loading={loading}>
            Save changes
          </Button>
        </Card>

        <Text style={[styles.sectionLabel, { color: c.textMuted, fontFamily: theme.fonts.bodyMedium }]}>Mode</Text>
        <Card style={styles.card}>
          <View style={styles.modeRow}>
            <View style={styles.modeText}>
              <Text style={[styles.modeLabel, { color: c.textPrimary, fontFamily: theme.fonts.bodySemibold }]}>
                {activePersona === "owner" ? "Owner mode" : "Driver mode"}
              </Text>
              <Text style={[styles.modeHint, { color: c.textMuted, fontFamily: theme.fonts.body }]}>
                {activePersona === "owner" ? "Managing your parking spaces" : "Finding and booking parking"}
              </Text>
            </View>
            <Button variant="secondary" onPress={handleSwitchPersona} loading={switching}>
              {`Switch to ${activePersona === "owner" ? "driver" : "owner"}`}
            </Button>
          </View>
        </Card>

        <Card style={[styles.signOutCard, { borderColor: c.dangerSoft }]}>
          <Button variant="danger" fullWidth onPress={handleLogout}>
            Sign out
          </Button>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 24, gap: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20 },
  name: { fontSize: 19 },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  phone: { fontSize: 14 },
  sectionLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 4 },
  card: { gap: 16 },
  modeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  modeText: { flex: 1, gap: 2 },
  modeLabel: { fontSize: 15 },
  modeHint: { fontSize: 12 },
  signOutCard: { borderWidth: 1, backgroundColor: "transparent", padding: 4 },
});
