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
 * The ParkAway palette (2026-09-23 redesign) — sourced from the product's
 * own design canvas (Marcellus/Manrope, ink/bone/brass/forest/rust), which
 * supersedes the three-separate-color-temperature approach this file used
 * before. Driver and owner personas share this **one** palette — the
 * mockups differentiate them through content and the persistent persona-
 * switch pill, not through a theme swap; a runtime "which persona" flag
 * still exists (see driver-web's theme.ts / driver-mobile's persona state)
 * but it no longer changes color roles the way `hostTheme` used to. `ink`
 * (near-black) is the primary text/hero-surface color, `brass` is the one
 * accent, `forest` reads as "verified/earning/positive", `rust` as danger.
 */
const ink = "#0A0A0A";
const bone = "#FFFFFF";
const surfaceWarm = "#F2F2F2";
const brass = "#C2703F";
const brassDeep = "#A15A2E";
const brassTint = "#F0D9C4";
const forest = "#33493C";
const forestTint = "#DBE4DC";
const rust = "#9B3A2E";
const rustTint = "#F0DAD2";
// Not in the source canvas (no warning color was needed there) — a muted
// gold kept in the same warm family as brass, rather than an unrelated hue.
const warningGold = "#8A5A1E";
const warningGoldTint = "#F0E2CE";

const parkAwayTheme: ColorRoles = {
  background: bone,
  surface: bone,
  surfaceRaised: surfaceWarm,
  border: "rgba(10, 10, 10, 0.07)", // --hairline-soft
  borderStrong: "rgba(10, 10, 10, 0.12)", // --hairline
  textPrimary: ink,
  textSecondary: "rgba(10, 10, 10, 0.68)", // --ink-70
  textMuted: "rgba(10, 10, 10, 0.52)", // --ink-55
  accent: brass,
  accentHover: brassDeep,
  accentContrast: bone,
  accentSoft: brassTint,
  success: forest,
  successSoft: forestTint,
  warning: warningGold,
  warningSoft: warningGoldTint,
  danger: rust,
  dangerSoft: rustTint,
  focusRing: brass,
};

/** Driver persona — see the module doc comment. */
export const driverTheme: ColorRoles = parkAwayTheme;

/**
 * Property Manager / Admin Web Console — same palette as the rest of the
 * product now (one coherent brand rather than a fourth color temperature
 * with no source mockup to justify it); "dense, scannable, unglamorous"
 * is expressed through admin-web's layout and information density, not
 * through a different accent hue.
 */
export const adminTheme: ColorRoles = parkAwayTheme;

/** Owner persona — see the module doc comment; identical to `driverTheme` by design. */
export const hostTheme: ColorRoles = parkAwayTheme;

export type ThemeName = "driver" | "admin" | "host";

export const themes: Record<ThemeName, ColorRoles> = {
  driver: driverTheme,
  admin: adminTheme,
  host: hostTheme,
};
