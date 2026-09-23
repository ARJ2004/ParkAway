import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "@parkaway/ui-native";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "./AuthContext";
import { MainTabs } from "./MainTabs";
import { OwnerTabs } from "./OwnerTabs";
import { PhoneEntryScreen } from "../screens/PhoneEntryScreen";
import { OtpEntryScreen } from "../screens/OtpEntryScreen";
import { PersonaScreen } from "../screens/PersonaScreen";
import { OnboardingProfileScreen } from "../screens/OnboardingProfileScreen";
import { OnboardingVehicleScreen } from "../screens/OnboardingVehicleScreen";
import { VehicleFormScreen } from "../screens/VehicleFormScreen";
import { PropertyFormScreen } from "../screens/owner/PropertyFormScreen";
import { ListingWizardScreen } from "../screens/owner/ListingWizardScreen";
import { HostKycScreen } from "../screens/owner/HostKycScreen";
import { HostPayoutScreen } from "../screens/owner/HostPayoutScreen";

export type AuthStackParamList = {
  PhoneEntry: undefined;
  OtpEntry: { phone: string };
};

export type OnboardingStackParamList = {
  OnboardingProfile: undefined;
  OnboardingVehicle: undefined;
};

/**
 * The logged-in DRIVER app is a stack with exactly two entries: the tab
 * navigator (MainTabs — Home/Vehicles/Profile) and VehicleForm, pushed on
 * top with a native header + back button when reached from any tab.
 */
export type AppStackParamList = {
  MainTabs: undefined;
  VehicleForm: undefined;
};

/**
 * The owner persona is a mode inside this same app (locked decision O-8),
 * not a separate app — its own stack, wrapping `OwnerTabs` plus the pushed
 * screens a host reaches from the checklist or the Spaces tab.
 */
export type OwnerStackParamList = {
  OwnerTabs: undefined;
  PropertyForm: undefined;
  ListingWizard: { listingId: string; step?: string };
  HostKyc: undefined;
  HostPayout: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const OwnerStack = createNativeStackNavigator<OwnerStackParamList>();

export function RootNavigator() {
  const { isLoggedIn, personaPending, activePersona, isNewUserPending, checkingSession } = useAuth();
  const theme = useTheme();

  if (checkingSession) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  const screenOptions = {
    headerShown: false,
    contentStyle: { backgroundColor: theme.colors.background },
  };

  if (!isLoggedIn) {
    return (
      <AuthStack.Navigator screenOptions={screenOptions}>
        <AuthStack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
        <AuthStack.Screen name="OtpEntry" component={OtpEntryScreen} />
      </AuthStack.Navigator>
    );
  }

  // First-login-only picker (AC-1, AC-3) — takes priority over the driver
  // onboarding wizard, which only starts once a persona has actually been
  // chosen (§2.2a: persona routing is UI-only, decided before any
  // persona-specific screen renders).
  if (personaPending) {
    return <PersonaScreen />;
  }

  if (activePersona === "owner") {
    return (
      <OwnerStack.Navigator screenOptions={screenOptions}>
        <OwnerStack.Screen name="OwnerTabs" component={OwnerTabs} />
        <OwnerStack.Screen name="PropertyForm" component={PropertyFormScreen} options={{ headerShown: true, title: "Add property" }} />
        <OwnerStack.Screen name="ListingWizard" component={ListingWizardScreen} />
        <OwnerStack.Screen name="HostKyc" component={HostKycScreen} />
        <OwnerStack.Screen name="HostPayout" component={HostPayoutScreen} />
      </OwnerStack.Navigator>
    );
  }

  if (isNewUserPending) {
    return (
      <OnboardingStack.Navigator screenOptions={screenOptions}>
        <OnboardingStack.Screen name="OnboardingProfile" component={OnboardingProfileScreen} />
        <OnboardingStack.Screen name="OnboardingVehicle" component={OnboardingVehicleScreen} />
      </OnboardingStack.Navigator>
    );
  }

  return (
    <AppStack.Navigator screenOptions={screenOptions}>
      <AppStack.Screen name="MainTabs" component={MainTabs} />
      <AppStack.Screen
        name="VehicleForm"
        component={VehicleFormScreen}
        options={{
          headerShown: true,
          title: "Add vehicle",
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.textPrimary,
          headerShadowVisible: false,
        }}
      />
    </AppStack.Navigator>
  );
}
