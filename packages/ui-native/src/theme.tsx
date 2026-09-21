import {
  driverTheme,
  fontSizeRaw,
  fontWeight,
  lineHeightMultiplier,
  motionRaw,
  radiusRaw,
  spaceRaw,
  type ColorRoles,
} from "@parkaway/design-tokens";
import { createContext, useContext, type ReactNode } from "react";
import { FONT_BODY, FONT_BODY_MEDIUM, FONT_BODY_SEMIBOLD, FONT_HEADING_SEMIBOLD, FONT_HEADING_BOLD } from "./fonts";

export interface Theme {
  colors: ColorRoles;
  space: typeof spaceRaw;
  radius: typeof radiusRaw;
  fontSize: typeof fontSizeRaw;
  fontWeight: typeof fontWeight;
  motion: typeof motionRaw;
  fonts: {
    body: string;
    bodyMedium: string;
    bodySemibold: string;
    headingSemibold: string;
    headingBold: string;
  };
}

/** RN's `lineHeight` is an absolute dp value, unlike CSS's unitless multiplier — this computes it per font size. */
export function lineHeightFor(fontSizePx: number, weight: keyof typeof lineHeightMultiplier = "normal"): number {
  return Math.round(fontSizePx * lineHeightMultiplier[weight]);
}

// Driver Mobile App is the only native surface built this sprint — Host/Owner
// App and Security Guard App will each get their own theme object here later
// (same shared scale, different color roles), same pattern as ui-web's
// driver/admin split.
const driverNativeTheme: Theme = {
  colors: driverTheme,
  space: spaceRaw,
  radius: radiusRaw,
  fontSize: fontSizeRaw,
  fontWeight,
  motion: motionRaw,
  fonts: {
    body: FONT_BODY,
    bodyMedium: FONT_BODY_MEDIUM,
    bodySemibold: FONT_BODY_SEMIBOLD,
    headingSemibold: FONT_HEADING_SEMIBOLD,
    headingBold: FONT_HEADING_BOLD,
  },
};

const ThemeContext = createContext<Theme>(driverNativeTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={driverNativeTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
