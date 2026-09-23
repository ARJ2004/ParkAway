import { useFonts } from "expo-font";
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { Marcellus_400Regular } from "@expo-google-fonts/marcellus";

// Native font family names are the exact strings @expo-google-fonts registers
// them under — not CSS-style family names — hence this indirection rather
// than reusing design-tokens' `fontFamily` (which is a CSS string).
//
// Marcellus ships one weight only (it's a display serif meant to be read at
// regular weight) — both heading roles resolve to it; "headingBold" exists
// so call sites don't need to know that, and stays a distinct constant in
// case a second display weight is ever added.
export const FONT_BODY = "Manrope_400Regular";
export const FONT_BODY_MEDIUM = "Manrope_500Medium";
export const FONT_BODY_SEMIBOLD_600 = "Manrope_600SemiBold";
export const FONT_BODY_SEMIBOLD = "Manrope_700Bold";
export const FONT_HEADING_SEMIBOLD = "Marcellus_400Regular";
export const FONT_HEADING_BOLD = "Marcellus_400Regular";

/** Call once near the app root; render nothing until it resolves `true`. */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Marcellus_400Regular,
  });
  return loaded;
}
