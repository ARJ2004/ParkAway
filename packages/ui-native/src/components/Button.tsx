import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { useTheme } from "../theme";

export interface ButtonProps extends Omit<PressableProps, "style"> {
  children: string;
  variant?: "primary" | "secondary" | "skip" | "danger";
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({ children, variant = "primary", fullWidth, loading, disabled, ...rest }: ButtonProps) {
  const theme = useTheme();
  const c = theme.colors;

  const variantStyles: Record<string, { bg: string; border: string; text: string }> = {
    primary: { bg: c.accent, border: c.accent, text: c.accentContrast },
    secondary: { bg: c.surface, border: c.borderStrong, text: c.textPrimary },
    // Skip carries the SAME size/padding/prominence as primary — only the
    // color role differs. It's a first-class action, not a de-emphasized
    // afterthought (Sprint 1 onboarding-wizard decision).
    skip: { bg: "transparent", border: c.borderStrong, text: c.textSecondary },
    danger: { bg: c.danger, border: c.danger, text: "#FFFFFF" },
  };
  const v = variantStyles[variant];

  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <Text style={[styles.label, { color: v.text, fontFamily: theme.fonts.bodySemibold }]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  fullWidth: {
    width: "100%",
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontSize: 16,
  },
});
