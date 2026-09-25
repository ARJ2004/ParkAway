import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type PressableProps } from "react-native";
import { useTheme } from "../theme";

export interface IconButtonProps extends Omit<PressableProps, "style" | "children"> {
  children: ReactNode;
  /** "outline": hairline border, transparent fill (back/notification/settings). "filled": ink background (support). */
  variant?: "outline" | "filled";
  size?: number;
  accessibilityLabel: string;
  /** Small dot in the top-right corner, e.g. an unread-notifications indicator. */
  badge?: boolean;
}

/** The circular icon-only button that recurs on nearly every screen header (back, notifications, support, settings). */
export function IconButton({ children, variant = "outline", size = 38, badge, disabled, ...rest }: IconButtonProps) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: variant === "filled" ? c.textPrimary : "transparent",
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: c.borderStrong,
        },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      {...rest}
    >
      {children}
      {badge && <View style={[styles.badgeDot, { backgroundColor: c.danger, borderColor: variant === "filled" ? c.textPrimary : c.background }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  badgeDot: { position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: 4, borderWidth: 1.5 },
});
