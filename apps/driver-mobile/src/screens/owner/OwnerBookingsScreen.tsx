import { useTheme } from "@parkaway/ui-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { OwnerTabParamList } from "../../navigation/OwnerTabs";
import type { OwnerStackParamList } from "../../navigation/RootNavigator";

type Props = CompositeScreenProps<BottomTabScreenProps<OwnerTabParamList, "OwnerBookings">, NativeStackScreenProps<OwnerStackParamList>>;

interface MockBooking {
  id: string;
  driver: string;
  spot: string;
  window: string;
  price: string;
  dotColor: "success" | "accent" | "danger" | "muted";
  disputed?: boolean;
}

/** Mock preview ahead of `BKG-*` (Sprint 4) — same discipline as the driver-side mock screens. */
const BOOKINGS: MockBooking[] = [
  { id: "ob1", driver: "Rohit S.", spot: "B2 · Slot 14", window: "Active · now till 9:30 PM", price: "₹180", dotColor: "success" },
  { id: "ob2", driver: "Divya M.", spot: "B2 · Slot 15", window: "Upcoming · 8:00 – 11:00 PM", price: "₹180", dotColor: "accent" },
  { id: "ob3", driver: "Farhan K.", spot: "Terrace · Slot 3", window: "Disputed · yesterday, overstay 40m", price: "₹210", dotColor: "danger", disputed: true },
  { id: "ob4", driver: "Priya N.", spot: "Forum B2 · Slot 14", window: "Completed · yesterday, 2:00 – 4:00 PM", price: "₹120", dotColor: "muted" },
];

export function OwnerBookingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const dotColors = { success: c.success, accent: c.accent, danger: c.danger, muted: c.textMuted };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Today · {BOOKINGS.length} bookings</Text>

        {BOOKINGS.map((booking) => (
          <TouchableOpacity
            key={booking.id}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("OwnerBookingDetail", { bookingId: booking.id })}
          >
            <View
              style={[
                styles.row,
                { backgroundColor: c.surface, borderColor: booking.disputed ? c.danger : c.borderStrong },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: dotColors[booking.dotColor] }]} />
              <View style={styles.info}>
                <Text style={[styles.window, { color: booking.disputed ? c.danger : c.textPrimary }]}>{booking.window}</Text>
                <Text style={[styles.meta, { color: c.textMuted }]}>
                  {booking.spot} · {booking.driver}
                </Text>
              </View>
              <Text style={[styles.price, { color: c.textPrimary }]}>{booking.price}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  heading: { fontSize: 20, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 18, padding: 16 },
  dot: { width: 6, height: 6, borderRadius: 4 },
  info: { flex: 1, gap: 2 },
  window: { fontSize: 12.5, fontWeight: "700" },
  meta: { fontSize: 11 },
  price: { fontSize: 13, fontWeight: "700" },
});
