import type { ReactNode } from "react";
import { Text, type TextStyle } from "react-native";
import { useTheme } from "../theme";

export interface EyebrowProps {
  children: ReactNode;
  color?: string;
  style?: TextStyle;
}

/** Small uppercase label — "01 — Where to", "Step 1 of 2", "Setup · 3 of 4 done". */
export function Eyebrow({ children, color, style }: EyebrowProps) {
  const theme = useTheme();
  return (
    <Text
      style={[
        { fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: color ?? theme.colors.textMuted, fontFamily: theme.fonts.bodySemibold },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
