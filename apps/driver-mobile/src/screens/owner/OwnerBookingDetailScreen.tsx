import { Button, IconButton, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { OwnerStackParamList } from "../../navigation/RootNavigator";

type Props = NativeStackScreenProps<OwnerStackParamList, "OwnerBookingDetail">;

/** Mock preview ahead of `BKG-*`/dispute handling (Sprint 4+) — same discipline as the driver-side mock screens. */
export function OwnerBookingDetailScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Back" onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={16} color={c.textPrimary} />
          </IconButton>
          <View style={styles.headerText}>
            <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Booking detail</Text>
            <Text style={[styles.headingMeta, { color: c.textMuted }]}>#PA-46810 · Terrace Row · Slot 3</Text>
          </View>
        </View>

        <View style={[styles.statusBanner, { backgroundColor: c.dangerSoft, borderColor: c.danger }]}>
          <Ionicons name="warning-outline" size={19} color={c.danger} style={styles.bannerIcon} />
          <View style={styles.bannerText}>
            <Text style={[styles.bannerTitle, { color: c.danger }]}>Disputed · overstayed by 40 minutes</Text>
            <Text style={[styles.bannerBody, { color: c.textSecondary }]}>Driver has not responded to the overstay fee yet.</Text>
          </View>
        </View>

        <View style={[styles.card, styles.driverCard, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
          <View style={[styles.avatar, { backgroundColor: c.surfaceRaised, borderColor: c.borderStrong }]}>
            <Text style={[styles.avatarLabel, { color: c.textSecondary, fontFamily: theme.fonts.headingSemibold }]}>F</Text>
          </View>
          <View style={styles.driverInfo}>
            <Text style={[styles.driverName, { color: c.textPrimary }]}>Farhan K.</Text>
            <Text style={[styles.driverMeta, { color: c.textMuted }]}>KA 01 AB 2093 · Hatchback</Text>
          </View>
          <IconButton accessibilityLabel="Message driver">
            <Ionicons name="chatbubble-outline" size={16} color={c.textPrimary} />
          </IconButton>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
          <Text style={[styles.cardTitle, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Session timeline</Text>
          {[
            { label: "Booked window", value: "Yesterday, 7:00 – 9:00 PM" },
            { label: "Checked in", value: "7:04 PM" },
            { label: "Actual exit", value: "9:40 PM", danger: true },
          ].map((row) => (
            <View key={row.label} style={styles.tableRow}>
              <Text style={[styles.rowLabel, { color: c.textSecondary }]}>{row.label}</Text>
              <Text style={[styles.rowValue, { color: row.danger ? c.danger : c.textPrimary }]}>{row.value}</Text>
            </View>
          ))}
          <View style={[styles.totalRow, { borderTopColor: c.border }]}>
            <Text style={[styles.totalLabel, { color: c.textPrimary }]}>Overstay</Text>
            <Text style={[styles.totalLabel, { color: c.danger }]}>40 minutes</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
          <Text style={[styles.cardTitle, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Fare</Text>
          <View style={styles.tableRow}>
            <Text style={[styles.rowLabel, { color: c.textSecondary }]}>Base · 2 hrs × ₹40</Text>
            <Text style={[styles.rowValue, { color: c.textPrimary }]}>₹80</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.rowLabel, { color: c.danger }]}>Overstay fee · 40 min</Text>
            <Text style={[styles.rowValue, { color: c.danger }]}>₹130</Text>
          </View>
          <View style={[styles.totalRow, { borderTopColor: c.border }]}>
            <Text style={[styles.totalLabel, { color: c.textPrimary }]}>Total</Text>
            <Text style={[styles.totalLabel, { color: c.textPrimary }]}>₹210</Text>
          </View>
        </View>

        <View style={styles.noteRow}>
          <Ionicons name="information-circle-outline" size={14} color={c.textMuted} style={styles.noteIcon} />
          <Text style={[styles.note, { color: c.textMuted }]}>
            Overstay is billed automatically to the card on file. You can waive it if there were extenuating circumstances.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: c.surface, borderTopColor: c.borderStrong }]}>
        <Button variant="danger" fullWidth>
          Charge overstay fee — ₹130
        </Button>
        <View style={styles.footerRow}>
          <TouchableOpacity style={[styles.footerButton, { borderColor: c.borderStrong }]}>
            <Text style={[styles.footerButtonLabel, { color: c.textPrimary }]}>Message driver</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.footerButton, { borderColor: c.borderStrong }]}>
            <Text style={[styles.footerButtonLabel, { color: c.textPrimary }]}>Waive fee</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 20, paddingBottom: 140 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { gap: 1 },
  heading: { fontSize: 18 },
  headingMeta: { fontSize: 11 },
  statusBanner: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 16, padding: 16 },
  bannerIcon: { marginTop: 1 },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { fontSize: 13.5, fontWeight: "700" },
  bannerBody: { fontSize: 11.5 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 12 },
  driverCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  avatarLabel: { fontSize: 18 },
  driverInfo: { flex: 1, gap: 2 },
  driverName: { fontSize: 14.5, fontWeight: "700" },
  driverMeta: { fontSize: 12 },
  cardTitle: { fontSize: 16 },
  tableRow: { flexDirection: "row", justifyContent: "space-between" },
  rowLabel: { fontSize: 12.5 },
  rowValue: { fontSize: 12.5, fontWeight: "700" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 12 },
  totalLabel: { fontSize: 14.5, fontWeight: "700" },
  noteRow: { flexDirection: "row", gap: 8, paddingHorizontal: 2 },
  noteIcon: { marginTop: 2 },
  note: { flex: 1, fontSize: 11.5, lineHeight: 17 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, padding: 18, gap: 10 },
  footerRow: { flexDirection: "row", gap: 10 },
  footerButton: { flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12, paddingVertical: 12 },
  footerButtonLabel: { fontSize: 13, fontWeight: "700" },
});
