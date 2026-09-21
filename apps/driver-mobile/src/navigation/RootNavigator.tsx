import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "@parkaway/ui-native";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "./AuthContext";
import { PhoneEntryScreen } from "../screens/PhoneEntryScreen";
import { OtpEntryScreen } from "../screens/OtpEntryScreen";
import { OnboardingProfileScreen } from "../screens/OnboardingProfileScreen";
import { OnboardingVehicleScreen } from "../screens/OnboardingVehicleScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { VehicleListScreen } from "../screens/VehicleListScreen";
import { VehicleFormScreen } from "../screens/VehicleFormScreen";

export type AuthStackParamList = {
  PhoneEntry: undefined;
  OtpEntry: { phone: string };
};

export type OnboardingStackParamList = {
  OnboardingProfile: undefined;
  OnboardingVehicle: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  Profile: undefined;
  Vehicles: undefined;
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
      <AppStack.Screen name="Home" component={HomeScreen} />
      <AppStack.Screen name="Profile" component={ProfileScreen} />
      <AppStack.Screen name="Vehicles" component={VehicleListScreen} />
      <AppStack.Screen
        name="VehicleForm"
        component={VehicleFormScreen}
        options={{ headerShown: true, title: "Add vehicle" }}
      />
    </AppStack.Navigator>
  );
}
