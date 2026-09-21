import { useRef } from "react";
import { StyleSheet, TextInput, View, type TextInput as TextInputType } from "react-native";
import { useTheme } from "../theme";

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}

/** Segmented OTP entry. Autofill (SMS one-time-code) lands as a multi-character onChangeText on whichever box is focused, so that path splits it across the remaining boxes the same way a paste would on web. */
export function OtpInput({ length = 6, value, onChange, error, autoFocus }: OtpInputProps) {
  const theme = useTheme();
  const c = theme.colors;
  const refs = useRef<(TextInputType | null)[]>([]);
  const digits = value.split("").concat(Array(length).fill("")).slice(0, length);

  function handleChangeText(index: number, text: string) {
    const numeric = text.replace(/\D/g, "");

    if (numeric.length > 1) {
      // Autofill/paste: distribute starting at this box.
      const merged = digits.slice();
      for (let i = 0; i < numeric.length && index + i < length; i++) {
        merged[index + i] = numeric[i]!;
      }
      onChange(merged.join(""));
      const nextIndex = Math.min(index + numeric.length, length - 1);
      refs.current[nextIndex]?.focus();
      return;
    }

    const next = digits.slice();
    next[index] = numeric;
    onChange(next.join(""));
    if (numeric && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(index: number, key: string) {
    if (key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  return (
    <View style={styles.row}>
      {digits.map((digit, i) => (
        <TextInput
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          style={[
            styles.digit,
            {
              borderColor: error ? c.danger : c.borderStrong,
              backgroundColor: c.surface,
              color: c.textPrimary,
              fontFamily: theme.fonts.bodySemibold,
            },
          ]}
          keyboardType="number-pad"
          maxLength={i === 0 ? length : 1}
          autoFocus={autoFocus && i === 0}
          textContentType={i === 0 ? "oneTimeCode" : "none"}
          autoComplete={i === 0 ? "sms-otp" : "off"}
          value={digit}
          onChangeText={(text) => handleChangeText(i, text)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  digit: {
    width: 44,
    height: 52,
    textAlign: "center",
    fontSize: 22,
    borderWidth: 1,
    borderRadius: 10,
  },
});
