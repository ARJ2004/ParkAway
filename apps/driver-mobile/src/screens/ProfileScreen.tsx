import { Button, Card, InlineBanner, TextField, useTheme } from "@parkaway/ui-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "../components/AppHeader";
import { ApiError } from "../api/client";
import { getProfile, updateProfile, type Profile } from "../api/profile";
import type { AppStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<AppStackParamList, "Profile">;

export function ProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  // Undefined = "not yet edited this session" -> falls back to the fetched
  // profile below once it arrives. Avoids copying the fetch result into
  // state via an effect (react-hooks/set-state-in-effect) — see the same
  // pattern in driver-web's ProfileScreen.
  const [name, setName] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

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

  if (!profile) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <AppHeader navigation={navigation} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
          Profile
        </Text>
        <Card style={styles.card}>
          {error && <InlineBanner variant="danger">{error}</InlineBanner>}
          {saved && <InlineBanner variant="success">Saved.</InlineBanner>}
          {/*
            Phone is read-only with no edit affordance at all — it's the
            verified identity anchor, matching the backend's hard rejection
            of phone-field updates.
          */}
          <TextField label="Mobile number" value={profile.phone} editable={false} badge="Verified" />
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 24, gap: 20 },
  heading: { fontSize: 22 },
  card: { gap: 16 },
});
