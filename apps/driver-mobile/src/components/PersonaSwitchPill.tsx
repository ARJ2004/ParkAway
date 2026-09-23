import { useTheme } from "@parkaway/ui-native";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../navigation/AuthContext";

/**
 * The persistent segmented persona switcher — matches the product's design
 * canvas exactly (pill track, active segment filled `ink`, always visible at
 * the top of Home/OwnerHome, not tucked into Profile). Switching is instant:
 * no re-auth, no reload, no more than one tap away from either persona.
 */
export function PersonaSwitchPill({ active }: { active: "driver" | "owner" }) {
  const theme = useTheme();
  const c = theme.colors;
  const { selectPersona } = useAuth();
  const [switching, setSwitching] = useState<"driver" | "owner" | null>(null);

  async function handlePress(persona: "driver" | "owner") {
    if (persona === active || switching) return;
    setSwitching(persona);
    try {
      await selectPersona(persona);
    } finally {
      setSwitching(null);
    }
  }

  return (
    <View style={[styles.track, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}>
      <Segment label="Driver" isActive={active === "driver"} loading={switching === "driver"} onPress={() => handlePress("driver")} />
      <Segment label="Owner" suffix="· Earn" isActive={active === "owner"} loading={switching === "owner"} onPress={() => handlePress("owner")} />
    </View>
  );
}

function Segment({ label, suffix, isActive, loading, onPress }: { label: string; suffix?: string; isActive: boolean; loading: boolean; onPress: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.segment, isActive && { backgroundColor: c.textPrimary }]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isActive ? c.background : c.textPrimary} />
      ) : (
        <Text style={[styles.label, { color: isActive ? c.background : c.textSecondary, fontFamily: theme.fonts.bodySemibold }]}>
          {label}
          {suffix ? <Text style={{ color: isActive ? c.accentSoft : c.accent }}> {suffix}</Text> : null}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", gap: 4, borderWidth: 1, borderRadius: 999, padding: 4 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 13 },
});
