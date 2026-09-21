import { Card, useTheme } from "@parkaway/ui-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "../components/AppHeader";
import { getProfile, type Profile } from "../api/profile";
import type { AppStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<AppStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <AppHeader navigation={navigation} />
      <View style={styles.content}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
          {profile?.name ? `Welcome back, ${profile.name}` : "Welcome back"}
        </Text>
        <Card>
          <Text style={{ color: theme.colors.textSecondary, fontFamily: theme.fonts.body, lineHeight: 22 }}>
            Search and booking are on the way (Sprint 3) — this is where destination-aware search will live. For
            now, your account is ready: manage your profile and vehicles from the nav above.
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 24, gap: 20 },
  heading: { fontSize: 22 },
});
