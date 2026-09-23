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
import { FONT_BODY, FONT_BODY_MEDIUM, FONT_BODY_SEMIBOLD, FONT_BODY_SEMIBOLD_600, FONT_HEADING_SEMIBOLD, FONT_HEADING_BOLD } from "./fonts";

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
    bodySemibold600: string;
    bodySemibold: string;
    headingSemibold: string;
    headingBold: string;
  };
}

/** RN's `lineHeight` is an absolute dp value, unlike CSS's unitless multiplier — this computes it per font size. */
export function lineHeightFor(fontSizePx: number, weight: keyof typeof lineHeightMultiplier = "normal"): number {
  return Math.round(fontSizePx * lineHeightMultiplier[weight]);
}

// Driver and owner personas share one palette by design (2026-09-23 redesign
// — see design-tokens/themes.ts's doc comment): there is deliberately no
// per-persona theme object here to swap at runtime. The persona switch pill
// (HomeScreen/OwnerHomeScreen) changes content and navigation, not color.
const parkAwayNativeTheme: Theme = {
  colors: driverTheme,
  space: spaceRaw,
  radius: radiusRaw,
  fontSize: fontSizeRaw,
  fontWeight,
  motion: motionRaw,
  fonts: {
    body: FONT_BODY,
    bodyMedium: FONT_BODY_MEDIUM,
    bodySemibold600: FONT_BODY_SEMIBOLD_600,
    bodySemibold: FONT_BODY_SEMIBOLD,
    headingSemibold: FONT_HEADING_SEMIBOLD,
    headingBold: FONT_HEADING_BOLD,
  },
};

const ThemeContext = createContext<Theme>(parkAwayNativeTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={parkAwayNativeTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
