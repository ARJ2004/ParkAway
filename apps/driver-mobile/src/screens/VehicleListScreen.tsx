import { Button, EmptyState, useTheme } from "@parkaway/ui-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { AppHeader } from "../components/AppHeader";
import { deactivateVehicle, listVehicles, setDefaultVehicle, type Vehicle } from "../api/vehicles";
import type { AppStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<AppStackParamList, "Vehicles">;

export function VehicleListScreen({ navigation }: Props) {
  const theme = useTheme();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    listVehicles().then((res) => setVehicles(res.vehicles.filter((v) => v.status === "active")));
  }, []);

  // Refetch whenever this tab/screen regains focus (e.g. after adding a
  // vehicle on VehicleForm and navigating back), not just on first mount.
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
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <AppHeader navigation={navigation} />
      <View style={styles.header}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
          Vehicles
        </Text>
        <Button onPress={() => navigation.navigate("VehicleForm")}>Add vehicle</Button>
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
            <View style={[styles.row, { borderColor: theme.colors.border }]}>
              <View>
                <Text style={[styles.reg, { color: theme.colors.textPrimary, fontFamily: theme.fonts.bodySemibold }]}>
                  {item.registrationNo}
                </Text>
                <Text style={[styles.meta, { color: theme.colors.textSecondary, fontFamily: theme.fonts.body }]}>
                  {item.type}
                  {item.makeModel ? ` · ${item.makeModel}` : ""}
                </Text>
                {item.isDefault && (
                  <Text style={[styles.defaultTag, { color: theme.colors.success, fontFamily: theme.fonts.bodyMedium }]}>
                    Default
                  </Text>
                )}
              </View>
              <View style={styles.actions}>
                {!item.isDefault && (
                  <Button variant="secondary" onPress={() => handleSetDefault(item.id)} loading={busyId === item.id}>
                    Set default
                  </Button>
                )}
                <Button variant="skip" onPress={() => handleRemove(item.id)} loading={busyId === item.id}>
                  Remove
                </Button>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 24, paddingBottom: 12 },
  heading: { fontSize: 22 },
  list: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  row: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 8 },
  reg: { fontSize: 16, letterSpacing: 0.5 },
  meta: { fontSize: 13 },
  defaultTag: { fontSize: 12 },
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
});
