import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { Sora_600SemiBold, Sora_700Bold } from "@expo-google-fonts/sora";

// Native font family names are the exact strings @expo-google-fonts registers
// them under — not CSS-style family names — hence this indirection rather
// than reusing design-tokens' `fontFamily` (which is a CSS string).
export const FONT_BODY = "Inter_400Regular";
export const FONT_BODY_MEDIUM = "Inter_500Medium";
export const FONT_BODY_SEMIBOLD = "Inter_600SemiBold";
export const FONT_HEADING_SEMIBOLD = "Sora_600SemiBold";
export const FONT_HEADING_BOLD = "Sora_700Bold";

/** Call once near the app root; render nothing until it resolves `true`. */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Sora_600SemiBold,
    Sora_700Bold,
  });
  return loaded;
}
