/**
 * Shared, surface-agnostic scale — spacing/type/radius/motion stay systematic
 * across every surface even though color themes differ (see themes.ts).
 * This is what makes "distinct per surface" and "consistent" compatible: the
 * rhythm is shared, the skin isn't.
 *
 * Raw numeric values are the single source of truth, consumed two ways:
 * - Web (ui-web/cssVariables.ts) appends units ("px", "ms") for CSS.
 * - Native (ui-native) uses the numbers directly — React Native's style
 *   values are unitless numbers (dp), not CSS strings.
 */

export const spaceRaw = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
} as const;

export const radiusRaw = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const fontSizeRaw = {
  xs: 12,
  sm: 14,
  base: 16,
  md: 18,
  lg: 22,
  xl: 28,
  "2xl": 36,
} as const;

/**
 * Unitless multipliers. CSS `line-height` accepts these directly; React
 * Native's `lineHeight` is an absolute dp value, so native consumers compute
 * `fontSizeRaw.x * lineHeightMultiplier.y` per text style rather than reusing
 * this as-is (see ui-native's `lineHeightFor` helper).
 */
export const lineHeightMultiplier = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
} as const;

export const motionRaw = {
  fast: 120,
  base: 200,
  slow: 360,
} as const;

function toPx<T extends Record<string, number>>(scale: T): { [K in keyof T]: string } {
  return Object.fromEntries(Object.entries(scale).map(([k, v]) => [k, `${v}px`])) as { [K in keyof T]: string };
}

export const space = toPx(spaceRaw);
export const radius = toPx(radiusRaw);
export const fontSize = toPx(fontSizeRaw);

export const fontFamily = {
  // Sora carries the display/heading moments (distinctive, geometric, not a
  // system-default sans) — Inter handles body/UI text where legibility at
  // small sizes matters more than character. Loaded via Google Fonts on web;
  // native loads the same two families as local font assets (see ui-native).
  heading: "'Sora', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
} as const;

export const lineHeight = {
  tight: String(lineHeightMultiplier.tight),
  normal: String(lineHeightMultiplier.normal),
  relaxed: String(lineHeightMultiplier.relaxed),
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const motion = {
  fast: `${motionRaw.fast}ms`,
  base: `${motionRaw.base}ms`,
  slow: `${motionRaw.slow}ms`,
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

export const shadow = {
  sm: "0 1px 2px rgba(20, 20, 16, 0.06)",
  md: "0 4px 12px rgba(20, 20, 16, 0.08)",
  lg: "0 12px 32px rgba(20, 20, 16, 0.12)",
} as const;
