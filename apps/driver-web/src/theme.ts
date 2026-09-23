import type { ThemeName } from "@parkaway/design-tokens";

/**
 * Runtime theme swap for the persona fork (05-sprint-2-detailed-plan.md
 * §3.1) — themes via CSS custom properties, so the swap is a data attribute
 * on the root element rather than replacing a `<style>` tag's content. Both
 * themes' variable sets are already present in the page (see main.tsx's
 * `multiThemeToCss` call); this just flips which one is active.
 */
export function setActiveTheme(theme: ThemeName): void {
  document.documentElement.setAttribute("data-theme", theme);
}

/** Persona is a product-facing concept ("owner"); `host` is the token system's theme name for it — kept distinct on purpose (see design-tokens/themes.ts). */
export function themeForPersona(persona: "driver" | "owner"): ThemeName {
  return persona === "owner" ? "host" : "driver";
}
