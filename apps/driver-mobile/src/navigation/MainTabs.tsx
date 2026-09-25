import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@parkaway/ui-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeScreen } from "../screens/HomeScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { VehicleListScreen } from "../screens/VehicleListScreen";
import { DriverSearchScreen } from "../screens/DriverSearchScreen";
import { DriverBookingsScreen } from "../screens/DriverBookingsScreen";

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Bookings: undefined;
  Vehicles: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: "home", inactive: "home-outline" },
  Search: { active: "search", inactive: "search-outline" },
  Bookings: { active: "receipt", inactive: "receipt-outline" },
  Vehicles: { active: "car-sport", inactive: "car-sport-outline" },
  Profile: { active: "person-circle", inactive: "person-circle-outline" },
};

/**
 * Bottom tab navigation — the native pattern, not a port of the web app's
 * top nav bar. Five tabs, matching the product's own design canvas
 * (Home/Search/Bookings/Garage/Profile). Search and Bookings render against
 * local mock data, not the real API — `SRCH-*`/booking search hasn't landed
 * yet (Sprint 3/4); see each screen's own doc comment. They're built now, as
 * a visual preview ahead of that backend, on explicit direction — replace
 * their mock data with real API calls when that work starts rather than
 * rebuilding the screens from scratch.
 */
export function MainTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.textPrimary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.borderStrong,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.bodySemibold600,
          fontSize: 10.5,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const iconSet = ICONS[route.name as keyof MainTabParamList];
          return <Ionicons name={focused ? iconSet.active : iconSet.inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={DriverSearchScreen} />
      <Tab.Screen name="Bookings" component={DriverBookingsScreen} />
      <Tab.Screen name="Vehicles" component={VehicleListScreen} options={{ tabBarLabel: "Garage" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
