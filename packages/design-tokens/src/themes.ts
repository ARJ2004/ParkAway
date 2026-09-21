export interface ColorRoles {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentContrast: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  focusRing: string;
}

/**
 * Driver Mobile App / Driver Web — "warm, fast, reassuring" (frontend.md
 * design philosophy). Warm neutral background instead of stark white, one
 * confident terracotta accent reserved for CTAs/status, a deep confident
 * green for "guaranteed/available" states — deliberately not a generic
 * blue/purple SaaS palette.
 */
export const driverTheme: ColorRoles = {
  background: "#FBF8F3",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  border: "#E7DFD3",
  borderStrong: "#D6C9B4",
  textPrimary: "#1F2A24",
  textSecondary: "#5B6660",
  textMuted: "#8B948E",
  accent: "#E4693B",
  accentHover: "#CC5A2F",
  accentContrast: "#FFFFFF",
  accentSoft: "#FCEAE0",
  success: "#1B6B4A",
  successSoft: "#E1F0E7",
  warning: "#C98A1A",
  warningSoft: "#FBF0DD",
  danger: "#C6432E",
  dangerSoft: "#FBE7E2",
  focusRing: "#E4693B",
};

/**
 * Property Manager / Admin Web Console — "dense, scannable, unglamorous."
 * Cool neutral grays, one functional accent (a deep teal — distinct from the
 * driver surface's warm terracotta, but drawn from the same "confident, not
 * corporate-blue" instinct), and a suspended/danger treatment that's a
 * distinct filled badge, not just red text.
 */
export const adminTheme: ColorRoles = {
  background: "#F5F6F7",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  border: "#DEE1E4",
  borderStrong: "#C7CCD1",
  textPrimary: "#14181C",
  textSecondary: "#4B5560",
  textMuted: "#7C8791",
  accent: "#1B4B43",
  accentHover: "#153B35",
  accentContrast: "#FFFFFF",
  accentSoft: "#E4EEEC",
  success: "#1B6B4A",
  successSoft: "#E1F0E7",
  warning: "#A66A00",
  warningSoft: "#FAF0DC",
  danger: "#B23A26",
  dangerSoft: "#F8E4DF",
  focusRing: "#1B4B43",
};

export type ThemeName = "driver" | "admin";

export const themes: Record<ThemeName, ColorRoles> = {
  driver: driverTheme,
  admin: adminTheme,
};
