import { Badge, EmptyState, IconButton, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listVehicles, type Vehicle } from "../api/vehicles";
import type { MainTabParamList } from "../navigation/MainTabs";
import type { AppStackParamList } from "../navigation/RootNavigator";

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, "Vehicles">, NativeStackScreenProps<AppStackParamList>>;

/** Card-based garage list — plate + type/model as the primary line, a themed icon tile, and a Default badge. Tapping a card opens it for editing (VehicleFormScreen). */
export function VehicleListScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const load = useCallback(() => {
    listVehicles().then((res) => setVehicles(res.vehicles.filter((v) => v.status === "active")));
  }, []);

  useFocusEffect(load);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Garage</Text>
        <IconButton accessibilityLabel="Add vehicle" variant="filled" onPress={() => navigation.navigate("VehicleForm")}>
          <Ionicons name="add" size={17} color={c.background} />
        </IconButton>
      </View>

      {vehicles.length === 0 ? (
        <EmptyState
          icon="🚗"
          title="No vehicles yet"
          description="Add one to book faster."
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={vehicles}
          keyExtractor={(v) => v.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate("VehicleForm", { vehicleId: item.id })} activeOpacity={0.85}>
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
                <View style={[styles.iconWrap, { backgroundColor: c.surfaceRaised }]}>
                  <Ionicons name="car-sport" size={22} color={c.textPrimary} />
                </View>
                <View style={styles.info}>
                  <View style={styles.plateRow}>
                    <Text style={[styles.plate, { color: c.textPrimary, fontFamily: theme.fonts.bodySemibold }]}>{item.registrationNo}</Text>
                    {item.isDefault && <Badge label="Default" variant="success" />}
                  </View>
                  <Text style={[styles.meta, { color: c.textMuted }]}>
                    {item.type[0]!.toUpperCase() + item.type.slice(1)}
                    {item.makeModel ? ` · ${item.makeModel}` : ""}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={c.textMuted} />
              </View>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <Text style={[styles.footNote, { color: c.textMuted }]}>Your default vehicle is pre-selected when booking a spot.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  heading: { fontSize: 22 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  card: { flexDirection: "row", gap: 14, borderWidth: 1, borderRadius: 18, padding: 16, alignItems: "center" },
  iconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  info: { flex: 1, gap: 3 },
  plateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  plate: { fontSize: 14.5 },
  meta: { fontSize: 12 },
  footNote: { textAlign: "center", fontSize: 10.5, marginTop: 8 },
});
