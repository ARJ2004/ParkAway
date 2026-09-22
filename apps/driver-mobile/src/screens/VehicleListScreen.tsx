import { Badge, Button, EmptyState, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { deactivateVehicle, listVehicles, setDefaultVehicle, type Vehicle } from "../api/vehicles";
import type { MainTabParamList } from "../navigation/MainTabs";
import type { AppStackParamList } from "../navigation/RootNavigator";

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, "Vehicles">, NativeStackScreenProps<AppStackParamList>>;

/** Card-based garage list — plate + type/model as the primary line, a themed icon tile, and an inline Default/Set-default affordance, rather than plain bordered text rows. */
export function VehicleListScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    listVehicles().then((res) => setVehicles(res.vehicles.filter((v) => v.status === "active")));
  }, []);

  useFocusEffect(load);

  async function handleSetDefault(id: string) {
    setBusyId(id);
    try {
      await setDefaultVehicle(id);
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(id: string) {
    setBusyId(id);
    try {
      await deactivateVehicle(id);
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingBold }]}>Vehicles</Text>
        <Button onPress={() => navigation.navigate("VehicleForm")}>Add</Button>
      </View>

      {vehicles.length === 0 ? (
        <EmptyState
          icon="🚗"
          title="No vehicles yet"
          description="Add one to book faster."
          action={<Button onPress={() => navigation.navigate("VehicleForm")}>Add your first vehicle</Button>}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={vehicles}
          keyExtractor={(v) => v.id}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={[styles.iconWrap, { backgroundColor: item.isDefault ? c.accentSoft : c.background }]}>
                <Ionicons name="car-sport" size={20} color={item.isDefault ? c.accent : c.textMuted} />
              </View>
              <View style={styles.info}>
                <Text style={[styles.plate, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
                  {item.registrationNo}
                </Text>
                <Text style={[styles.meta, { color: c.textSecondary, fontFamily: theme.fonts.body }]}>
                  {item.type}
                  {item.makeModel ? ` · ${item.makeModel}` : ""}
                </Text>
                <View style={styles.actions}>
                  {item.isDefault ? (
                    <Badge label="Default" variant="success" />
                  ) : (
                    <Text
                      style={[styles.link, { color: c.accent, fontFamily: theme.fonts.bodyMedium }]}
                      onPress={() => handleSetDefault(item.id)}
                    >
                      {busyId === item.id ? "Setting…" : "Set as default"}
                    </Text>
                  )}
                  <Text
                    style={[styles.link, { color: c.textMuted, fontFamily: theme.fonts.bodyMedium }]}
                    onPress={() => handleRemove(item.id)}
                  >
                    {busyId === item.id ? "" : "Remove"}
                  </Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  heading: { fontSize: 26 },
  list: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  card: {
    flexDirection: "row",
    gap: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "flex-start",
  },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  info: { flex: 1, gap: 4 },
  plate: { fontSize: 16, letterSpacing: 0.3 },
  meta: { fontSize: 13 },
  actions: { flexDirection: "row", gap: 16, marginTop: 4 },
  link: { fontSize: 13 },
});
