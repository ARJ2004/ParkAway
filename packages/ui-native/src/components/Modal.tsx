import type { ReactNode } from "react";
import { Modal as RNModal, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}

export function Modal({ open, title, onClose, children, actions }: ModalProps) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <RNModal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: c.surface }]}>
          <Text style={[styles.title, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>{title}</Text>
          {children}
          {actions && <View style={styles.actions}>{actions}</View>}
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(20, 20, 16, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  title: { fontSize: 18 },
  actions: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
});
