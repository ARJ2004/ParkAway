import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@parkaway/ui-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeScreen } from "../screens/HomeScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { VehicleListScreen } from "../screens/VehicleListScreen";

export type MainTabParamList = {
  Home: undefined;
  Vehicles: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: "home", inactive: "home-outline" },
  Vehicles: { active: "car-sport", inactive: "car-sport-outline" },
  Profile: { active: "person-circle", inactive: "person-circle-outline" },
};

/**
 * Bottom tab navigation — the native pattern, not a port of the web app's
 * top nav bar. Three tabs, matching exactly what's built this sprint (no
 * placeholder "Search"/"Bookings" tab for features that don't exist yet —
 * those join the bar when Sprint 3 lands them). Each tab screen renders its
 * own content from the safe-area top with no native-stack header — the tab
 * bar plus each screen's own heading is the only chrome, closer to how
 * Freenow/Careem/Lyft structure their driver-facing home tabs than to a
 * ported desktop layout.
 */
export function MainTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.bodyMedium,
          fontSize: 11,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const iconSet = ICONS[route.name as keyof MainTabParamList];
          return <Ionicons name={focused ? iconSet.active : iconSet.inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Vehicles" component={VehicleListScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
