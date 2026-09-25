import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "../theme";

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  badge?: string;
}

export function TextField({ label, error, hint, badge, style, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.wrapper}>
      {label && <Text style={[styles.label, { color: c.textSecondary, fontFamily: theme.fonts.bodyMedium }]}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          {
            borderColor: error ? c.danger : c.borderStrong,
            backgroundColor: rest.editable === false ? c.background : c.surfaceRaised,
            color: c.textPrimary,
            fontFamily: theme.fonts.body,
          },
          style,
        ]}
        placeholderTextColor={c.textMuted}
        {...rest}
      />
      {badge && <Text style={[styles.badge, { color: c.success, fontFamily: theme.fonts.bodyMedium }]}>{badge}</Text>}
      {error && <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>}
      {!error && hint && <Text style={[styles.hint, { color: c.textMuted }]}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 4 },
  label: { fontSize: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  badge: { fontSize: 12 },
  errorText: { fontSize: 12 },
  hint: { fontSize: 12 },
});
