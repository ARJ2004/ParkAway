import { StyleSheet, View } from "react-native";
import { useTheme } from "../theme";

export interface WizardProgressProps {
  total: number;
  currentIndex: number;
}

/** Soft dots, not a numbered "step X of Y" bar — orients without quantifying pressure on a recommended, skippable flow. */
export function WizardProgress({ total, currentIndex }: WizardProgressProps) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: c.borderStrong },
            i === currentIndex && { backgroundColor: c.accent, width: 20 },
            i < currentIndex && { backgroundColor: c.success },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 999 },
});
