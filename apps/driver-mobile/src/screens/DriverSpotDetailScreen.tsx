import { Badge, IconButton, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppStackParamList } from "../navigation/RootNavigator";
import { MOCK_SPOTS } from "./DriverSearchScreen";

type Props = NativeStackScreenProps<AppStackParamList, "DriverSpotDetail">;

const CONVENIENCE_FEE_PAISE = 800;
const WINDOW_HOURS = 3;

/** Mock preview ahead of `SRCH-*`/`BKG-*` (Sprint 3/4) — see DriverSearchScreen's doc comment. */
export function DriverSpotDetailScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const spot = MOCK_SPOTS.find((s) => s.id === route.params.spotId) ?? MOCK_SPOTS[0]!;
  const subtotal = spot.pricePerHour * WINDOW_HOURS * 100;
  const total = subtotal + CONVENIENCE_FEE_PAISE;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: spot.gradient[0] }]}>
          <SafeAreaView edges={["top"]}>
            <View style={styles.heroRow}>
              <IconButton accessibilityLabel="Back" variant="filled" onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
              </IconButton>
              <IconButton accessibilityLabel="Save spot" variant="filled">
                <Ionicons name="heart-outline" size={16} color="#FFFFFF" />
              </IconButton>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          <View style={styles.titleBlock}>
            <View style={styles.metaRow}>
              <Ionicons name="shield-checkmark" size={13} color={c.success} />
              <Text style={[styles.metaText, { color: c.success }]}>Verified host</Text>
              {spot.rating && (
                <>
                  <Text style={{ color: c.textMuted }}>·</Text>
                  <Ionicons name="star" size={12} color={c.accent} />
                  <Text style={[styles.metaText, { color: c.textMuted }]}>{spot.rating} (212 stays)</Text>
                </>
              )}
            </View>
            <Text style={[styles.title, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>{spot.name}</Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              {spot.locality} · {spot.distanceKm} km away
            </Text>
            <View style={styles.tagRow}>
              {spot.tags.map((tag) => (
                <Badge key={tag} label={tag} variant="neutral" />
              ))}
            </View>
          </View>

          <View style={[styles.guaranteeStrip, { backgroundColor: c.textPrimary }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={c.accentSoft} style={styles.guaranteeIcon} />
            <Text style={[styles.guaranteeText, { color: "rgba(255,255,255,0.85)" }]}>
              This exact slot is reserved the moment you book — held for you, never double-booked, never &ldquo;maybe available.&rdquo;
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
            <Text style={[styles.cardTitle, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Booking window</Text>
            <View style={styles.windowRow}>
              {[
                { label: "Today", value: "24 Sep" },
                { label: "From", value: "6:30 PM" },
                { label: "For", value: `${WINDOW_HOURS} hrs` },
              ].map((item) => (
                <View key={item.label} style={[styles.windowCell, { backgroundColor: c.surfaceRaised, borderColor: c.borderStrong }]}>
                  <Text style={[styles.windowLabel, { color: c.textMuted }]}>{item.label}</Text>
                  <Text style={[styles.windowValue, { color: c.textPrimary }]}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
            <Text style={[styles.cardTitle, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Price breakdown</Text>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: c.textSecondary }]}>
                Parking · {WINDOW_HOURS} hrs × ₹{spot.pricePerHour}
              </Text>
              <Text style={[styles.priceValue, { color: c.textPrimary }]}>₹{(subtotal / 100).toFixed(0)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: c.textSecondary }]}>Convenience fee</Text>
              <Text style={[styles.priceValue, { color: c.textPrimary }]}>₹{(CONVENIENCE_FEE_PAISE / 100).toFixed(0)}</Text>
            </View>
            <View style={[styles.totalRow, { borderTopColor: c.border }]}>
              <Text style={[styles.totalLabel, { color: c.textPrimary }]}>Total due</Text>
              <Text style={[styles.totalLabel, { color: c.textPrimary }]}>₹{(total / 100).toFixed(0)}</Text>
            </View>
          </View>

          <View style={[styles.card, styles.accessCard, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
            <View style={[styles.accessIcon, { backgroundColor: c.accentSoft }]}>
              <Ionicons name="qr-code-outline" size={19} color={c.accentHover} />
            </View>
            <Text style={[styles.accessText, { color: c.textSecondary }]}>
              Your QR access credential is issued the moment you book. Show it at the gate to check in.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: c.surface, borderTopColor: c.borderStrong }]}>
        <View style={styles.footerTotal}>
          <Text style={[styles.footerTotalLabel, { color: c.textMuted }]}>Total for {WINDOW_HOURS} hrs</Text>
          <Text style={[styles.footerTotalValue, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>₹{(total / 100).toFixed(0)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.bookButton, { backgroundColor: c.accent }]}
          onPress={() => navigation.navigate("DriverBookingConfirmed")}
        >
          <Text style={[styles.bookButtonLabel, { color: c.accentContrast, fontFamily: theme.fonts.bodySemibold }]}>Book this spot</Text>
          <Ionicons name="arrow-forward" size={14} color={c.accentContrast} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 116 },
  hero: { height: 220 },
  heroRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12 },
  body: { padding: 20, gap: 20 },
  titleBlock: { gap: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 11.5, fontWeight: "700" },
  title: { fontSize: 24 },
  subtitle: { fontSize: 12.5 },
  tagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", paddingTop: 2 },
  guaranteeStrip: { borderRadius: 16, padding: 16, flexDirection: "row", gap: 12 },
  guaranteeIcon: { marginTop: 1 },
  guaranteeText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 12 },
  cardTitle: { fontSize: 16 },
  windowRow: { flexDirection: "row", gap: 8 },
  windowCell: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10, gap: 3 },
  windowLabel: { fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 },
  windowValue: { fontSize: 13, fontWeight: "700" },
  priceRow: { flexDirection: "row", justifyContent: "space-between" },
  priceLabel: { fontSize: 13 },
  priceValue: { fontSize: 13, fontWeight: "600" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 12 },
  totalLabel: { fontSize: 14.5, fontWeight: "700" },
  accessCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  accessIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  accessText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, padding: 20, flexDirection: "row", alignItems: "center", gap: 14 },
  footerTotal: { gap: 1 },
  footerTotalLabel: { fontSize: 10 },
  footerTotalValue: { fontSize: 19 },
  bookButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 16 },
  bookButtonLabel: { fontSize: 15 },
});
