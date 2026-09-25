import { Badge, Button, Card, IconButton, InlineBanner, TextField, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../../api/client";
import { getHostProfile, setPayoutDetails } from "../../api/hostProfile";

// The payout HISTORY rows below are illustrative — payout execution (PAY-04)
// hasn't shipped yet (Sprint 6), so there's nothing real to show. The
// account-on-file section above them is real and unchanged.
const MOCK_HISTORY = [
  { date: "19 Sep", amount: "₹6,120" },
  { date: "12 Sep", amount: "₹5,480" },
  { date: "5 Sep", amount: "₹4,910" },
];

/** Deliberately last and skippable — payout is "so you can get paid", never a gate on listing work. */
export function HostPayoutScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const [currentLast4, setCurrentLast4] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getHostProfile()
        .then((p) => setCurrentLast4(p.payoutAccountLast4))
        .catch(() => {});
    }, [])
  );

  async function handleSave() {
    setError(null);
    setLoading(true);
    try {
      const result = await setPayoutDetails({ accountHolderName, bankName, ifsc, accountNumber });
      setCurrentLast4(result.last4);
      setAccountNumber("");
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your payout details.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Payouts</Text>
        {error && <InlineBanner variant="danger">{error}</InlineBanner>}
        {saved && <InlineBanner variant="success">Saved.</InlineBanner>}

        {currentLast4 && (
          <View style={[styles.nextPayoutCard, { backgroundColor: c.textPrimary }]}>
            <Text style={[styles.nextPayoutEyebrow, { color: c.accentSoft }]}>Next payout</Text>
            <Text style={[styles.nextPayoutValue, { fontFamily: theme.fonts.headingSemibold }]}>₹9,240</Text>
            <Text style={styles.nextPayoutMeta}>Arrives Friday · HDFC ···{currentLast4}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Payout method</Text>
          {currentLast4 && !editing ? (
            <View style={[styles.methodCard, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
              <View style={[styles.methodIcon, { backgroundColor: c.accentSoft }]}>
                <Ionicons name="card-outline" size={19} color={c.accentHover} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={[styles.methodTitle, { color: c.textPrimary }]}>Account ending in {currentLast4}</Text>
                <Text style={[styles.methodMeta, { color: c.textMuted }]}>Encrypted · never shown in full</Text>
              </View>
              <Badge label="Active" variant="success" />
              <IconButton accessibilityLabel="Edit payout method" onPress={() => setEditing(true)}>
                <Ionicons name="pencil" size={14} color={c.textPrimary} />
              </IconButton>
            </View>
          ) : (
            <Card style={styles.card}>
              <TextField label="Account holder name" value={accountHolderName} onChangeText={setAccountHolderName} />
              <TextField label="Bank name" value={bankName} onChangeText={setBankName} />
              <TextField label="IFSC" value={ifsc} onChangeText={(t) => setIfsc(t.toUpperCase())} placeholder="HDFC0001234" autoCapitalize="characters" />
              <TextField label="Account number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" placeholder={currentLast4 ? `•••• ${currentLast4}` : undefined} />
              <Text style={[styles.note, { color: c.textMuted }]}>
                Your account number is encrypted before storage and is never shown back to you or anyone else in full.
              </Text>
              <Button onPress={handleSave} loading={loading} disabled={!accountHolderName.trim() || !bankName.trim() || !ifsc.trim() || !accountNumber.trim()}>
                Save payout details
              </Button>
            </Card>
          )}
        </View>

        {currentLast4 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Payout history</Text>
            {MOCK_HISTORY.map((row) => (
              <View key={row.date} style={[styles.historyRow, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
                <View style={[styles.historyIcon, { backgroundColor: c.successSoft }]}>
                  <Ionicons name="checkmark" size={13} color={c.success} />
                </View>
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyTitle, { color: c.textPrimary }]}>{row.date} · Weekly payout</Text>
                  <Text style={[styles.historyMeta, { color: c.textMuted }]}>HDFC ···{currentLast4}</Text>
                </View>
                <Text style={[styles.historyAmount, { color: c.textPrimary }]}>{row.amount}</Text>
              </View>
            ))}
            <Text style={[styles.footNote, { color: c.textMuted }]}>Payouts run every Friday for the prior week&apos;s net earnings.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 20, paddingBottom: 48 },
  heading: { fontSize: 22 },
  nextPayoutCard: { borderRadius: 22, padding: 24, gap: 6 },
  nextPayoutEyebrow: { fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase" },
  nextPayoutValue: { fontSize: 36, color: "#FFFFFF" },
  nextPayoutMeta: { fontSize: 12.5, color: "rgba(255,255,255,0.6)" },
  section: { gap: 12 },
  sectionLabel: { fontSize: 16 },
  card: { gap: 14 },
  note: { fontSize: 11, lineHeight: 15 },
  methodCard: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderRadius: 18, padding: 16 },
  methodIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  methodInfo: { flex: 1, gap: 2 },
  methodTitle: { fontSize: 13.5, fontWeight: "700" },
  methodMeta: { fontSize: 11.5 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 18, padding: 14 },
  historyIcon: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  historyInfo: { flex: 1, gap: 2 },
  historyTitle: { fontSize: 12.5, fontWeight: "700" },
  historyMeta: { fontSize: 11 },
  historyAmount: { fontSize: 13, fontWeight: "700" },
  footNote: { textAlign: "center", fontSize: 11, marginTop: 4 },
});
