import { IconButton, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<AppStackParamList, "DriverBookingConfirmed">;

/** Mock preview ahead of `BKG-*` (Sprint 4) — see DriverSearchScreen's doc comment. */
export function DriverBookingConfirmedScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.closeRow}>
          <IconButton accessibilityLabel="Close" onPress={() => navigation.navigate("MainTabs")}>
            <Ionicons name="close" size={16} color={c.textPrimary} />
          </IconButton>
        </View>

        <View style={styles.confirmBlock}>
          <View style={[styles.confirmIcon, { backgroundColor: c.successSoft }]}>
            <Ionicons name="checkmark-circle" size={28} color={c.success} />
          </View>
          <Text style={[styles.confirmTitle, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Your spot is guaranteed</Text>
          <Text style={[styles.confirmMeta, { color: c.textMuted }]}>Booking #PA-48213 · Confirmed 5:52 PM</Text>
        </View>

        <View style={[styles.qrCard, { backgroundColor: c.textPrimary }]}>
          <Text style={[styles.qrEyebrow, { color: c.accentSoft }]}>Access credential</Text>
          <View style={[styles.qrBox, { backgroundColor: c.background }]}>
            <Ionicons name="qr-code" size={110} color={c.textPrimary} />
          </View>
          <Text style={styles.qrNote}>Show this at the gate, or let it scan automatically on arrival.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={17} color={c.accentHover} style={styles.detailIcon} />
            <View>
              <Text style={[styles.detailTitle, { color: c.textPrimary }]}>Forum Courtyard — B2 · Slot 14</Text>
              <Text style={[styles.detailMeta, { color: c.textMuted }]}>80 Feet Rd, Koramangala</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <View style={styles.gridRow}>
            <View style={styles.gridCell}>
              <Text style={[styles.gridLabel, { color: c.textMuted }]}>Window</Text>
              <Text style={[styles.gridValue, { color: c.textPrimary }]}>6:30 – 9:30 PM</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={[styles.gridLabel, { color: c.textMuted }]}>Vehicle</Text>
              <Text style={[styles.gridValue, { color: c.textPrimary }]}>KA 05 MJ 4421</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <View style={styles.gridRow}>
            <Text style={[styles.paidLabel, { color: c.textSecondary }]}>Paid · UPI</Text>
            <Text style={[styles.paidValue, { color: c.textPrimary }]}>₹188</Text>
          </View>
        </View>

        <View style={styles.secondaryRow}>
          <TouchableOpacity style={[styles.secondaryButton, { borderColor: c.borderStrong }]}>
            <Ionicons name="location-outline" size={14} color={c.textPrimary} />
            <Text style={[styles.secondaryLabel, { color: c.textPrimary }]}>Directions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryButton, { borderColor: c.borderStrong }]}>
            <Ionicons name="wallet-outline" size={14} color={c.textPrimary} />
            <Text style={[styles.secondaryLabel, { color: c.textPrimary }]}>Add to Wallet</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: c.surface, borderTopColor: c.borderStrong }]}>
        <TouchableOpacity style={[styles.arriveButton, { backgroundColor: c.accent }]} onPress={() => navigation.navigate("DriverActiveSession")}>
          <Text style={[styles.arriveLabel, { color: c.accentContrast, fontFamily: theme.fonts.bodySemibold }]}>I&apos;ve arrived — Check in</Text>
          <Ionicons name="arrow-forward" size={14} color={c.accentContrast} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 20, paddingBottom: 100 },
  closeRow: { alignItems: "flex-end" },
  confirmBlock: { alignItems: "center", gap: 10, paddingHorizontal: 12 },
  confirmIcon: { width: 52, height: 52, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  confirmTitle: { fontSize: 24 },
  confirmMeta: { fontSize: 12.5 },
  qrCard: { borderRadius: 22, padding: 26, alignItems: "center", gap: 16 },
  qrEyebrow: { fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase" },
  qrBox: { width: 172, height: 172, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  qrNote: { fontSize: 12, color: "rgba(255,255,255,0.65)", textAlign: "center" },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 14 },
  detailRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  detailIcon: { marginTop: 2 },
  detailTitle: { fontSize: 14, fontWeight: "700" },
  detailMeta: { fontSize: 12 },
  divider: { height: 1 },
  gridRow: { flexDirection: "row", justifyContent: "space-between" },
  gridCell: { gap: 2 },
  gridLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  gridValue: { fontSize: 13.5, fontWeight: "700" },
  paidLabel: { fontSize: 13 },
  paidValue: { fontSize: 13, fontWeight: "700" },
  secondaryRow: { flexDirection: "row", gap: 10 },
  secondaryButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 12 },
  secondaryLabel: { fontSize: 13, fontWeight: "700" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, padding: 20 },
  arriveButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 16 },
  arriveLabel: { fontSize: 15 },
});
