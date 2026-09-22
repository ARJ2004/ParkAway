import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "@parkaway/ui-native";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "./AuthContext";
import { MainTabs } from "./MainTabs";
import { PhoneEntryScreen } from "../screens/PhoneEntryScreen";
import { OtpEntryScreen } from "../screens/OtpEntryScreen";
import { OnboardingProfileScreen } from "../screens/OnboardingProfileScreen";
import { OnboardingVehicleScreen } from "../screens/OnboardingVehicleScreen";
import { VehicleFormScreen } from "../screens/VehicleFormScreen";

export type AuthStackParamList = {
  PhoneEntry: undefined;
  OtpEntry: { phone: string };
};

export type OnboardingStackParamList = {
  OnboardingProfile: undefined;
  OnboardingVehicle: undefined;
};

/**
 * The logged-in app is a stack with exactly two entries: the tab navigator
 * (MainTabs — Home/Vehicles/Profile, see MainTabs.tsx) and VehicleForm,
 * pushed on top with a native header + back button when reached from any
 * tab. This is what lets `navigation.navigate("VehicleForm")` work from
 * inside a tab screen (React Navigation resolves an unrecognized screen name
 * by walking up to the parent navigator) without VehicleForm itself living
 * inside the tab bar.
 */
export type AppStackParamList = {
  MainTabs: undefined;
  VehicleForm: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

export function RootNavigator() {
  const { isLoggedIn, isNewUserPending, checkingSession } = useAuth();
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
