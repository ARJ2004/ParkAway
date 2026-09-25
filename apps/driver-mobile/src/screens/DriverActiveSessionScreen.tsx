import { Button, IconButton, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<AppStackParamList, "DriverActiveSession">;

/** Mock preview ahead of `BKG-*` (Sprint 4) — see DriverSearchScreen's doc comment. */
export function DriverActiveSessionScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Your session</Text>
          <IconButton accessibilityLabel="Support">
            <Ionicons name="headset-outline" size={16} color={c.textPrimary} />
          </IconButton>
        </View>

        <View style={[styles.statusCard, { backgroundColor: c.success }]}>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>Parked · active</Text>
          </View>
          <Text style={styles.remaining}>1h 42m</Text>
          <Text style={styles.remainingSub}>remaining</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: "72%", backgroundColor: c.accentSoft }]} />
          </View>
          <Text style={styles.endsNote}>Ends 9:30 PM · overstaying is billed per minute</Text>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
          <View style={[styles.thumb, { backgroundColor: "#3a3630" }]} />
          <View style={styles.recapInfo}>
            <Text style={[styles.recapTitle, { color: c.textPrimary }]}>Forum Courtyard — B2 · Slot 14</Text>
            <Text style={[styles.recapMeta, { color: c.textMuted }]}>KA 05 MJ 4421 · Checked in 7:04 PM</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.card, styles.extendCard, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
          <View style={[styles.extendIcon, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="add" size={18} color={c.accentHover} />
          </View>
          <Text style={[styles.extendLabel, { color: c.textPrimary }]}>Extend by 1 hour</Text>
          <Text style={[styles.extendPrice, { color: c.textMuted }]}>+₹60</Text>
        </TouchableOpacity>

        <View style={[styles.helpGroup, { borderColor: c.borderStrong }]}>
          <TouchableOpacity style={[styles.helpRow, { backgroundColor: c.surface }]}>
            <Ionicons name="chatbubble-outline" size={15} color={c.textSecondary} />
            <Text style={[styles.helpLabel, { color: c.textPrimary }]}>Message the host</Text>
            <Ionicons name="chevron-forward" size={13} color={c.textMuted} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <TouchableOpacity style={[styles.helpRow, { backgroundColor: c.surface }]}>
            <Ionicons name="warning-outline" size={15} color={c.danger} />
            <Text style={[styles.helpLabel, { color: c.danger }]}>Report an issue with this spot</Text>
            <Ionicons name="chevron-forward" size={13} color={c.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: c.surface, borderTopColor: c.borderStrong }]}>
        <Button fullWidth>End session &amp; pay</Button>
        <TouchableOpacity onPress={() => navigation.navigate("MainTabs")}>
          <Text style={[styles.backHome, { color: c.textMuted }]}>Back to home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 20, paddingBottom: 116 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontSize: 20 },
  statusCard: { borderRadius: 22, padding: 28, alignItems: "center", gap: 14 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#8FC79B" },
  liveLabel: { fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", fontWeight: "700", color: "#FFFFFF" },
  remaining: { fontSize: 34, color: "#FFFFFF", fontFamily: "Marcellus_400Regular" },
  remainingSub: { fontSize: 11.5, color: "rgba(255,255,255,0.7)", marginTop: -8 },
  progressTrack: { width: "100%", height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  endsNote: { fontSize: 12.5, color: "rgba(255,255,255,0.75)" },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  thumb: { width: 46, height: 46, borderRadius: 12 },
  recapInfo: { flex: 1, gap: 2, minWidth: 0 },
  recapTitle: { fontSize: 14, fontWeight: "700" },
  recapMeta: { fontSize: 11.5 },
  extendCard: { justifyContent: "flex-start" },
  extendIcon: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  extendLabel: { flex: 1, fontSize: 13.5, fontWeight: "700" },
  extendPrice: { fontSize: 13, fontWeight: "700" },
  helpGroup: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  helpRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  helpLabel: { flex: 1, fontSize: 13, fontWeight: "600" },
  divider: { height: 1 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, padding: 20, gap: 10 },
  backHome: { textAlign: "center", fontSize: 12, fontWeight: "700" },
});
