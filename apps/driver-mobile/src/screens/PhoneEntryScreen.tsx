import { Button, InlineBanner, TextField, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { requestOtp } from "../api/auth";
import { ApiError } from "../api/client";
import type { AuthStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "PhoneEntry">;

/**
 * Deliberately sparse — no marketing carousel, no illustration competing
 * with the single task. The objective is explicitly "low-friction": this
 * screen should feel like five seconds, not a funnel.
 */
export function PhoneEntryScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await requestOtp(phone);
      navigation.navigate("OtpEntry", { phone });
    } catch (err) {
      if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        setError("Too many attempts for this number — please try again in a little while.");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.content}>
          <View style={styles.brandRow}>
            <Ionicons name="location" size={20} color={c.textPrimary} />
            <Text style={[styles.brand, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>ParkAway</Text>
          </View>

          <View style={styles.form}>
            <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Enter your phone number</Text>
            <Text style={[styles.subheading, { color: c.textMuted }]}>
              We&apos;ll text you a code to verify it&apos;s you. Same number for parking or hosting.
            </Text>

            {error && <InlineBanner variant="danger">{error}</InlineBanner>}
            <TextField
              keyboardType="phone-pad"
              placeholder="+91 98765 43210"
              value={phone}
              onChangeText={setPhone}
              autoFocus
              style={styles.phoneInput}
            />
            <Button onPress={handleSubmit} fullWidth loading={loading} disabled={phone.length < 6}>
              Continue
            </Button>
          </View>

          <Text style={[styles.terms, { color: c.textMuted }]}>
            By continuing, you agree to ParkAway&apos;s <Text style={{ textDecorationLine: "underline", color: c.textPrimary }}>Terms</Text> and{" "}
            <Text style={{ textDecorationLine: "underline", color: c.textPrimary }}>Privacy Policy</Text>.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 20, justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brand: { fontSize: 19 },
  form: { flex: 1, justifyContent: "center", gap: 16 },
  heading: { fontSize: 30, lineHeight: 36 },
  subheading: { fontSize: 13.5, lineHeight: 20, marginTop: -6, marginBottom: 4 },
  phoneInput: { fontWeight: "700", letterSpacing: 0.4 },
  terms: { textAlign: "center", fontSize: 11.5, lineHeight: 17, paddingBottom: 12 },
});
