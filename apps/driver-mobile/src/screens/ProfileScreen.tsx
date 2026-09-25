import { Badge, Card, IconButton, InlineBanner, TextField, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
 * Avatar + name/phone header, a big persona-switch card (matches the design
 * canvas — the switch is important enough to be a card, not a settings
 * row), grouped editable fields, sign-out as its own clearly separated
 * destructive row at the bottom.
 *
 * Shared across both `MainTabs` and `OwnerTabs` (deliberately not typed
 * against either tab navigator's param list) — a person's name and phone
 * don't change with their hat. Takes no navigation props; sign-out and the
 * persona switch both go through `AuthContext`, never a direct navigation call.
 */
export function ProfileScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { logout, activePersona, availablePersonas, selectPersona } = useAuth();
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

  const isOwner = activePersona === "owner";
  const canSwitch = availablePersonas.length > 1;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: c.textPrimary }]}>
            <Text style={[styles.avatarText, { color: c.accentSoft, fontFamily: theme.fonts.headingSemibold }]}>
              {initialsOf(profile.name)}
            </Text>
          </View>
          <View>
            <Text style={[styles.name, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
              {profile.name || "Add your name"}
            </Text>
            <View style={styles.phoneRow}>
              <Text style={[styles.phone, { color: c.textMuted }]}>{profile.phone}</Text>
              <Badge label="Verified" variant="success" />
            </View>
          </View>
        </View>

        {canSwitch && (
          <TouchableOpacity onPress={handleSwitchPersona} disabled={switching} activeOpacity={0.85}>
            <View style={[styles.switchCard, { backgroundColor: c.textPrimary }]}>
              <View style={[styles.switchIconWrap, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
                <Ionicons name={isOwner ? "car-sport-outline" : "business-outline"} size={18} color={c.accentSoft} />
              </View>
              <View style={styles.switchText}>
                <Text style={styles.switchTitle}>Switch to {isOwner ? "parking" : "hosting"}</Text>
                <Text style={styles.switchHint}>{isOwner ? "Find and book a guaranteed spot" : "List a space and start earning"}</Text>
              </View>
              {switching ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />}
            </View>
          </TouchableOpacity>
        )}

        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Personal details</Text>
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
          <TouchableOpacity onPress={handleSave} disabled={loading} style={[styles.saveButton, { backgroundColor: c.textPrimary }]}>
            {loading ? <ActivityIndicator color={c.background} /> : <Text style={[styles.saveLabel, { color: c.background }]}>Save changes</Text>}
          </TouchableOpacity>
        </Card>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutRow}>
          <IconButton accessibilityLabel="Log out" variant="outline">
            <Ionicons name="log-out-outline" size={16} color={c.danger} />
          </IconButton>
          <Text style={[styles.logoutLabel, { color: c.danger }]}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 21 },
  name: { fontSize: 19 },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  phone: { fontSize: 12 },
  switchCard: { borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  switchIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  switchText: { flex: 1, gap: 2 },
  switchTitle: { fontSize: 14.5, fontWeight: "700", color: "#FFFFFF" },
  switchHint: { fontSize: 11.5, color: "rgba(255,255,255,0.6)" },
  sectionLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700" },
  card: { gap: 16 },
  saveButton: { borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  saveLabel: { fontSize: 15, fontWeight: "700" },
  logoutRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 8 },
  logoutLabel: { fontSize: 13.5, fontWeight: "700" },
});
