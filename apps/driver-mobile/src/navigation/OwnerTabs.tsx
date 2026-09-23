import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@parkaway/ui-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OwnerHomeScreen } from "../screens/owner/OwnerHomeScreen";
import { ListingListScreen } from "../screens/owner/ListingListScreen";
import { ProfileScreen } from "../screens/ProfileScreen";

export type OwnerTabParamList = {
  OwnerHome: undefined;
  Spaces: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<OwnerTabParamList>();

const ICONS: Record<keyof OwnerTabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  OwnerHome: { active: "home", inactive: "home-outline" },
  Spaces: { active: "business", inactive: "business-outline" },
  Profile: { active: "person-circle", inactive: "person-circle-outline" },
};

/**
 * The owner persona's tab bar — same shell/shape as `MainTabs` (three tabs,
 * `Profile` shared across both personas per its own doc comment), different
 * screen set. No separate theme swap: driver and owner share one palette by
 * design (2026-09-23 redesign) — only content and navigation differ.
 */
export function OwnerTabs() {
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
          const iconSet = ICONS[route.name as keyof OwnerTabParamList];
          return <Ionicons name={focused ? iconSet.active : iconSet.inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="OwnerHome" component={OwnerHomeScreen} options={{ tabBarLabel: "Home" }} />
      <Tab.Screen name="Spaces" component={ListingListScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
