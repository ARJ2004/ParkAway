import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";

export interface BadgeProps {
  label: string;
  variant?: "success" | "accent" | "neutral";
}

/** Small status pill — "Default" on a vehicle card, "Verified" next to a phone number, etc. */
export function Badge({ label, variant = "neutral" }: BadgeProps) {
  const theme = useTheme();
  const c = theme.colors;

  const variants: Record<string, { bg: string; text: string }> = {
    success: { bg: c.successSoft, text: c.success },
    accent: { bg: c.accentSoft, text: c.accent },
    neutral: { bg: c.background, text: c.textSecondary },
  };
  const v = variants[variant];

  return (
    <View style={[styles.badge, { backgroundColor: v.bg }]}>
      <Text style={[styles.label, { color: v.text, fontFamily: theme.fonts.bodyMedium }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 12,
  },
});
