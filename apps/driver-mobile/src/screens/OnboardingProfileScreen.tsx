import { Button, Eyebrow, InlineBanner, TextField, WizardProgress, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../api/client";
import { updateProfile } from "../api/profile";
import type { OnboardingStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingProfile">;

export function OnboardingProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!name && !email) {
      navigation.navigate("OnboardingVehicle");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await updateProfile({ ...(name ? { name } : {}), ...(email ? { email } : {}) });
      navigation.navigate("OnboardingVehicle");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your profile — you can add this later.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <View style={styles.content}>
        <WizardProgress total={2} currentIndex={0} />

        <View style={styles.form}>
          <View style={styles.heading}>
            <Eyebrow color={theme.colors.accentHover}>Step 1 of 2</Eyebrow>
            <Text style={[styles.title, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Tell us about you</Text>
            <Text style={[styles.subheading, { color: c.textMuted }]}>This appears on your bookings and to hosts when you check in.</Text>
          </View>

          <View style={styles.avatarRow}>
            <View style={[styles.avatarPlaceholder, { backgroundColor: c.surfaceRaised, borderColor: c.borderStrong }]}>
              <Ionicons name="person-outline" size={22} color={c.textMuted} />
            </View>
            <Text style={[styles.avatarLabel, { color: c.textPrimary }]}>Add a photo (optional)</Text>
          </View>

          {error && <InlineBanner variant="danger">{error}</InlineBanner>}
          <TextField label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
          <TextField
            label="Email (optional)"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity onPress={() => navigation.navigate("OnboardingVehicle")} disabled={loading}>
            <Text style={[styles.skipLabel, { color: c.textMuted }]}>Skip</Text>
          </TouchableOpacity>
          <Button onPress={handleContinue} loading={loading} fullWidth>
            Continue
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20, justifyContent: "space-between" },
  form: { gap: 20 },
  heading: { gap: 8 },
  title: { fontSize: 27, lineHeight: 33 },
  subheading: { fontSize: 13.5, lineHeight: 20 },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 999, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  avatarLabel: { fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
  actions: { gap: 12 },
  skipLabel: { textAlign: "center", fontSize: 13, fontWeight: "700" },
});
