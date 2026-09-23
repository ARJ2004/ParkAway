import { fontFamily, fontSize, fontWeight, lineHeight, motion, radius, shadow, space } from "./scale";
import { type ColorRoles, themes, type ThemeName } from "./themes";

function kebabify(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function scaleToVars(prefix: string, scale: Record<string, string>): string {
  return Object.entries(scale)
    .map(([key, value]) => `  --${prefix}-${kebabify(key)}: ${value};`)
    .join("\n");
}

function colorsToVars(colors: ColorRoles): string {
  return Object.entries(colors)
    .map(([key, value]) => `  --color-${kebabify(key)}: ${value};`)
    .join("\n");
}

/**
 * Produces a `{ selector } { --token: value; ... }` block for the given
 * theme (default selector `:root`, i.e. the whole app is that theme). The
 * shared scale (spacing/type/radius/motion) is identical across themes —
 * only the color roles change — which is the mechanism behind "shared
 * rhythm, distinct skin" described in themes.ts.
 */
export function themeToCss(themeName: ThemeName, selector = ":root"): string {
  const colors = themes[themeName];
  return [
    `${selector} {`,
    colorsToVars(colors),
    scaleToVars("space", space),
    scaleToVars("radius", radius),
    scaleToVars("font-size", fontSize),
    scaleToVars("line-height", lineHeight),
    scaleToVars("font-weight", fontWeight),
    `  --font-heading: ${fontFamily.heading};`,
    `  --font-body: ${fontFamily.body};`,
    scaleToVars("motion", { fast: motion.fast, base: motion.base, slow: motion.slow }),
    `  --motion-easing: ${motion.easing};`,
    scaleToVars("shadow", shadow),
    "}",
  ].join("\n");
}

/**
 * A stylesheet carrying *every* theme in `themeNames`, each scoped under
 * `:root[data-theme="<name>"]`, plus the first theme unscoped under plain
 * `:root` so the page renders correctly before any `data-theme` attribute
 * is set. Switching theme at runtime (the persona fork, §3.1) is then just
 * `document.documentElement.setAttribute('data-theme', name)` — no style
 * tag replacement, no flash.
 */
export function multiThemeToCss(themeNames: ThemeName[]): string {
  if (themeNames.length === 0) return "";
  const blocks = [themeToCss(themeNames[0]!, ":root")];
  for (const name of themeNames) {
    blocks.push(themeToCss(name, `:root[data-theme="${name}"]`));
  }
  return blocks.join("\n\n");
}
