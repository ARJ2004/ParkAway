import { useTheme } from "@parkaway/ui-native";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../navigation/AuthContext";

/**
 * First-login-only (AC-1, AC-3) — asks someone to declare an intent, not
 * enter data. Two full-width cards, equal weight, no pre-selected default,
 * no "recommended" badge — a nudge here would misroute people for the sake
 * of a funnel metric. Driver and owner personas share one palette in this
 * design (see design-tokens/themes.ts) so the cards are differentiated by
 * icon and copy, not by color temperature.
 */
export function PersonaScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { selectPersona } = useAuth();
  const [loading, setLoading] = useState<"driver" | "owner" | null>(null);

  async function pick(persona: "driver" | "owner") {
    setLoading(persona);
    try {
      await selectPersona(persona);
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.content}>
        <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
          What brings you to ParkAway?
        </Text>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => pick("driver")}
          disabled={loading !== null}
          style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderStrong }]}
        >
          <Text style={styles.icon}>🚗</Text>
          <Text style={[styles.cardTitle, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Park a vehicle</Text>
          <Text style={[styles.cardBody, { color: c.textSecondary, fontFamily: theme.fonts.body }]}>
            Find and book guaranteed parking near you.
          </Text>
          {loading === "driver" && <ActivityIndicator style={styles.spinner} color={c.accent} />}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => pick("owner")}
          disabled={loading !== null}
          style={[styles.card, styles.ownerCard, { backgroundColor: c.textPrimary, borderColor: c.textPrimary }]}
        >
          <Text style={styles.icon}>🅿️</Text>
          <Text style={[styles.cardTitle, { color: c.background, fontFamily: theme.fonts.headingSemibold }]}>Rent out my space</Text>
          <Text style={[styles.cardBody, { color: "rgba(255,255,255,0.72)", fontFamily: theme.fonts.body }]}>
            List a parking spot, set your price, earn from it.
          </Text>
          {loading === "owner" && <ActivityIndicator style={styles.spinner} color={c.accent} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  heading: { fontSize: 24, textAlign: "center", marginBottom: 8, lineHeight: 30 },
  card: { borderWidth: 1, borderRadius: 22, padding: 26, gap: 8 },
  ownerCard: { borderWidth: 0 },
  icon: { fontSize: 30 },
  cardTitle: { fontSize: 19 },
  cardBody: { fontSize: 14, lineHeight: 20 },
  spinner: { position: "absolute", top: 22, right: 22 },
});
