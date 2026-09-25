import { Badge, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MainTabParamList } from "../navigation/MainTabs";
import type { AppStackParamList } from "../navigation/RootNavigator";

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, "Bookings">, NativeStackScreenProps<AppStackParamList>>;

interface MockBooking {
  id: string;
  spot: string;
  window: string;
  price: string;
  status: "active" | "upcoming" | "past";
}

const BOOKINGS: MockBooking[] = [
  { id: "b1", spot: "Forum Courtyard — B2 · Slot 14", window: "Today, 6:30 – 9:30 PM", price: "₹188", status: "active" },
  { id: "b2", spot: "St. Johns Lit Lot — T2", window: "Tomorrow, 9:00 – 11:00 AM", price: "₹80", status: "upcoming" },
  { id: "b3", spot: "Meera's Driveway — HSR", window: "18 Sep, 2:00 – 4:00 PM", price: "₹70", status: "past" },
];

const STATUS_LABEL: Record<MockBooking["status"], string> = { active: "Active", upcoming: "Upcoming", past: "Completed" };
const STATUS_VARIANT: Record<MockBooking["status"], "success" | "accent" | "neutral"> = { active: "success", upcoming: "accent", past: "neutral" };

/** Mock preview ahead of `BKG-*` (Sprint 4) — see DriverSearchScreen's doc comment. */
export function DriverBookingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Your bookings</Text>

        {BOOKINGS.map((booking) => (
          <TouchableOpacity
            key={booking.id}
            onPress={() => navigation.navigate(booking.status === "active" ? "DriverActiveSession" : "DriverBookingConfirmed")}
            activeOpacity={0.85}
          >
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
              <View style={[styles.iconWrap, { backgroundColor: c.surfaceRaised }]}>
                <Ionicons name="car-sport-outline" size={20} color={c.textPrimary} />
              </View>
              <View style={styles.info}>
                <View style={styles.topRow}>
                  <Badge label={STATUS_LABEL[booking.status]} variant={STATUS_VARIANT[booking.status]} />
                  <Text style={[styles.price, { color: c.textPrimary }]}>{booking.price}</Text>
                </View>
                <Text style={[styles.spot, { color: c.textPrimary }]}>{booking.spot}</Text>
                <Text style={[styles.window, { color: c.textMuted }]}>{booking.window}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  heading: { fontSize: 22, marginBottom: 4 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: "row", gap: 14 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  info: { flex: 1, gap: 4 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  price: { fontSize: 13, fontWeight: "700" },
  spot: { fontSize: 14, fontWeight: "700" },
  window: { fontSize: 12 },
});
