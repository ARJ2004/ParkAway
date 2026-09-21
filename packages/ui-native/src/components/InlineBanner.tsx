import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";

export interface InlineBannerProps {
  variant?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
}

export function InlineBanner({ variant = "info", children }: InlineBannerProps) {
  const theme = useTheme();
  const c = theme.colors;

  const variants: Record<string, { bg: string; text: string }> = {
    info: { bg: c.accentSoft, text: c.textPrimary },
    success: { bg: c.successSoft, text: c.success },
    warning: { bg: c.warningSoft, text: c.warning },
    danger: { bg: c.dangerSoft, text: c.danger },
  };
  const v = variants[variant];

  return (
    <View style={[styles.banner, { backgroundColor: v.bg }]}>
      <Text style={[styles.text, { color: v.text, fontFamily: theme.fonts.body }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 10, padding: 14 },
  text: { fontSize: 14 },
});
