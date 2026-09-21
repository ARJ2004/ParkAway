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
 * Produces a `:root { --token: value; ... }` block for the given theme. The
 * shared scale (spacing/type/radius/motion) is identical across themes —
 * only the color roles change — which is the mechanism behind "shared
 * rhythm, distinct skin" described in themes.ts.
 */
export function themeToCss(themeName: ThemeName): string {
  const colors = themes[themeName];
  return [
    ":root {",
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
