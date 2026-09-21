import { Button, InlineBanner, TextField, WizardProgress, useTheme } from "@parkaway/ui-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../api/client";
import { updateProfile } from "../api/profile";
import type { OnboardingStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingProfile">;

export function OnboardingProfileScreen({ navigation }: Props) {
  const theme = useTheme();
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
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <WizardProgress total={2} currentIndex={0} />
        <Text style={[styles.heading, { color: theme.colors.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
          Tell us about you
        </Text>
        <Text style={[styles.subheading, { color: theme.colors.textSecondary, fontFamily: theme.fonts.body }]}>
          Recommended — helps hosts and support recognize you. Skip anytime.
        </Text>

        <View style={styles.form}>
          {error && <InlineBanner variant="danger">{error}</InlineBanner>}
          <TextField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <TextField
            label="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
          />
          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <Button variant="skip" onPress={() => navigation.navigate("OnboardingVehicle")} disabled={loading} fullWidth>
                Skip
              </Button>
            </View>
            <View style={styles.actionButton}>
              <Button onPress={handleContinue} loading={loading} fullWidth>
                Continue
              </Button>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  heading: { fontSize: 24, textAlign: "center" },
  subheading: { fontSize: 14, textAlign: "center" },
  form: { gap: 16, marginTop: 8 },
  actions: { flexDirection: "row", gap: 12 },
  actionButton: { flex: 1 },
});
