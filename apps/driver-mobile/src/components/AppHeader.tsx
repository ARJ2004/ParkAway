import { useTheme } from "@parkaway/ui-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { logout as apiLogout } from "../api/auth";
import { useAuth } from "../navigation/AuthContext";
import type { AppStackParamList } from "../navigation/RootNavigator";
import { clearSession, getRefreshToken } from "../session";

export function AppHeader({
  navigation,
}: {
  navigation: NativeStackNavigationProp<AppStackParamList, keyof AppStackParamList>;
}) {
  const theme = useTheme();
  const { logout } = useAuth();

  async function handleLogout() {
    const refreshToken = await getRefreshToken();
    await clearSession();
    logout();
    if (refreshToken) {
      apiLogout(refreshToken).catch(() => {});
    }
  }

  return (
    <View style={[styles.nav, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.brand, { color: theme.colors.accent, fontFamily: theme.fonts.headingSemibold }]}>ParkAway</Text>
      <View style={styles.links}>
        <TouchableOpacity onPress={() => navigation.navigate("Home")}>
          <Text style={[styles.link, { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyMedium }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Vehicles")}>
          <Text style={[styles.link, { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyMedium }]}>Vehicles</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          <Text style={[styles.link, { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyMedium }]}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={[styles.link, { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyMedium }]}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  brand: { fontSize: 16 },
  links: { flexDirection: "row", gap: 16, marginLeft: "auto" },
  link: { fontSize: 13 },
});
