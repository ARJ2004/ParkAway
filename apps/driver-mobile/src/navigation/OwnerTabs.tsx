import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@parkaway/ui-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OwnerHomeScreen } from "../screens/owner/OwnerHomeScreen";
import { ListingListScreen } from "../screens/owner/ListingListScreen";
import { OwnerBookingsScreen } from "../screens/owner/OwnerBookingsScreen";
import { HostPayoutScreen } from "../screens/owner/HostPayoutScreen";
import { ProfileScreen } from "../screens/ProfileScreen";

export type OwnerTabParamList = {
  OwnerHome: undefined;
  Spaces: undefined;
  OwnerBookings: undefined;
  Earnings: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<OwnerTabParamList>();

const ICONS: Record<keyof OwnerTabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  OwnerHome: { active: "home", inactive: "home-outline" },
  Spaces: { active: "grid", inactive: "grid-outline" },
  OwnerBookings: { active: "receipt", inactive: "receipt-outline" },
  Earnings: { active: "card", inactive: "card-outline" },
  Profile: { active: "person-circle", inactive: "person-circle-outline" },
};

/**
 * The owner persona's tab bar — same shell/shape as `MainTabs` (`Profile`
 * shared across both personas per its own doc comment), five tabs matching
 * the design canvas (Home/Listings/Bookings/Earnings/Profile). No separate
 * theme swap: driver and owner share one palette by design (2026-09-23
 * redesign) — only content and navigation differ. `Earnings` renders the
 * same `HostPayoutScreen` also reachable via `OwnerStack` push from Home's
 * quick actions — one screen, two entry points, not a duplicate.
 */
export function OwnerTabs() {
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
          const iconSet = ICONS[route.name as keyof OwnerTabParamList];
          return <Ionicons name={focused ? iconSet.active : iconSet.inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="OwnerHome" component={OwnerHomeScreen} options={{ tabBarLabel: "Home" }} />
      <Tab.Screen name="Spaces" component={ListingListScreen} options={{ tabBarLabel: "Listings" }} />
      <Tab.Screen name="OwnerBookings" component={OwnerBookingsScreen} options={{ tabBarLabel: "Bookings" }} />
      <Tab.Screen name="Earnings" component={HostPayoutScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
