import { Button, IconButton, InlineBanner, OtpInput, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { requestOtp, verifyOtp } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../navigation/AuthContext";
import type { AuthStackParamList } from "../navigation/RootNavigator";
import { setSession } from "../session";

type Props = NativeStackScreenProps<AuthStackParamList, "OtpEntry">;

const RESEND_COOLDOWN_SECONDS = 30;
// Must match the backend's OTP_LENGTH (apps/api/src/env.ts) — the length the
// OTP input actually collects, not an arbitrary guess (this exact mismatch
// bit the web app during manual testing: a 4-digit bypass code against a
// 6-digit OTP_LENGTH never matched what the UI collected).
const OTP_LENGTH = 6;

export function OtpEntryScreen({ route, navigation }: Props) {
  const { phone } = route.params;
  const theme = useTheme();
  const c = theme.colors;
  const { login } = useAuth();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleVerify(submittedCode: string) {
    if (submittedCode.length !== OTP_LENGTH) return;
    setError(null);
    setLoading(true);
    try {
      const result = await verifyOtp(phone, submittedCode);
      await setSession(result.accessToken, result.refreshToken);
      // login() resolves persona state (RootNavigator then routes to the
      // persona picker on first login, or straight to the right persona's
      // stack on a return visit — see RootNavigator.tsx).
      await login(result.isNewUser);
    } catch (err) {
      if (err instanceof ApiError) {
        const messages: Record<string, string> = {
          OTP_INCORRECT: err.message,
          OTP_INVALIDATED: "Too many incorrect attempts. Request a new code below.",
          OTP_EXPIRED_OR_NOT_FOUND: "This code has expired. Request a new one below.",
          OTP_ALREADY_USED: "This code was already used. Request a new one below.",
          ACCOUNT_SUSPENDED: "This account has been suspended. Contact support for help.",
          RATE_LIMITED: "Too many attempts — please try again shortly.",
        };
        setError(messages[err.code] ?? err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    setCode("");
    try {
      await requestOtp(phone);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError("Could not resend the code — please try again shortly.");
    }
  }

  const cooldownLabel = `0:${cooldown.toString().padStart(2, "0")}`;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <View style={styles.content}>
        <IconButton accessibilityLabel="Back" onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={15} color={c.textPrimary} />
        </IconButton>

        <View style={styles.form}>
          <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Enter the code</Text>
          <Text style={[styles.subheading, { color: c.textMuted }]}>
            Code sent to {phone} · <Text onPress={() => navigation.goBack()} style={[styles.editLink, { color: c.textPrimary }]}>Edit</Text>
          </Text>

          {error && <InlineBanner variant="danger">{error}</InlineBanner>}
          <OtpInput length={OTP_LENGTH} value={code} onChange={setCode} error={!!error} autoFocus />

          <View style={styles.actions}>
            <Button onPress={() => handleVerify(code)} fullWidth loading={loading} disabled={code.length !== OTP_LENGTH}>
              Verify
            </Button>
            <TouchableOpacity onPress={handleResend} disabled={cooldown > 0}>
              <Text style={[styles.resendLabel, { color: c.textMuted }]}>
                {cooldown > 0 ? (
                  <>
                    Didn&apos;t get it? Resend in <Text style={{ color: c.textPrimary, fontWeight: "700" }}>{cooldownLabel}</Text>
                  </>
                ) : (
                  "Resend code"
                )}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  form: { flex: 1, justifyContent: "center", gap: 24 },
  heading: { fontSize: 30, lineHeight: 36 },
  subheading: { fontSize: 13.5, lineHeight: 20, marginTop: -12 },
  editLink: { textDecorationLine: "underline", fontWeight: "600" },
  actions: { gap: 16, alignItems: "center" },
  resendLabel: { fontSize: 12.5, textAlign: "center" },
});
