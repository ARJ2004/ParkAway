import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.wrapper}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={[styles.title, { color: c.textPrimary, fontFamily: theme.fonts.bodySemibold }]}>{title}</Text>
      {description && (
        <Text style={[styles.description, { color: c.textSecondary, fontFamily: theme.fonts.body }]}>{description}</Text>
      )}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: 12, paddingVertical: 48, paddingHorizontal: 16 },
  icon: { fontSize: 32 },
  title: { fontSize: 18, textAlign: "center" },
  description: { fontSize: 14, textAlign: "center", maxWidth: 280 },
});
