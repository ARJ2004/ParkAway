import type { ReactNode } from "react";
import styles from "./DetailPanel.module.css";

export interface DetailPanelProps {
  list: ReactNode;
  detail: ReactNode | null;
  emptyDetailMessage?: string;
}

/**
 * The list+right-detail-panel layout shell — moderation queue, property
 * detail. Built once, used by both consoles (§3.1), rather than each screen
 * rolling its own two-pane layout.
 */
export function DetailPanel({ list, detail, emptyDetailMessage = "Select an item to view details" }: DetailPanelProps) {
  return (
    <div className={styles.layout}>
      <div className={styles.listPane}>{list}</div>
      <div className={styles.detailPane}>{detail ?? <div className={styles.empty}>{emptyDetailMessage}</div>}</div>
    </div>
  );
}
