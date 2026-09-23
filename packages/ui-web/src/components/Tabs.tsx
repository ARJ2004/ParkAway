import styles from "./Tabs.module.css";

export interface TabItem {
  value: string;
  label: string;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
}

/** Property detail (Overview/Authorization/Access policy), moderation queue status tabs. Web-only — the native side uses its tab bar. */
export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div className={styles.tabs} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          className={[styles.tab, tab.value === value ? styles.active : ""].join(" ")}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
