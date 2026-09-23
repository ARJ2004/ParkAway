import styles from "./TimeRangeField.module.css";

export interface TimeRangeValue {
  /** 0 = Sunday .. 6 = Saturday */
  daysOfWeek: number[];
  /** minutes from midnight, IST wall-clock (see api's resolve.ts for why IST is fixed regardless of the viewer's device timezone) */
  startMin: number;
  endMin: number;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export interface TimeRangeFieldProps {
  label?: string;
  value: TimeRangeValue;
  onChange: (value: TimeRangeValue) => void;
}

/** Gate hours (Property Manager Console and the owner persona), peak/weekend pricing windows — day-of-week chips + a start/end time. */
export function TimeRangeField({ label, value, onChange }: TimeRangeFieldProps) {
  function toggleDay(day: number) {
    const has = value.daysOfWeek.includes(day);
    onChange({
      ...value,
      daysOfWeek: has ? value.daysOfWeek.filter((d) => d !== day) : [...value.daysOfWeek, day].sort((a, b) => a - b),
    });
  }

  return (
    <div className={styles.wrapper}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.days}>
        {DAY_LABELS.map((letter, i) => (
          <button
            key={DAY_NAMES[i]}
            type="button"
            aria-label={DAY_NAMES[i]}
            aria-pressed={value.daysOfWeek.includes(i)}
            className={[styles.dayChip, value.daysOfWeek.includes(i) ? styles.dayChipActive : ""].join(" ")}
            onClick={() => toggleDay(i)}
          >
            {letter}
          </button>
        ))}
      </div>
      <div className={styles.times}>
        <input
          type="time"
          className={styles.timeInput}
          value={minutesToHHMM(value.startMin)}
          onChange={(e) => onChange({ ...value, startMin: hhmmToMinutes(e.target.value) })}
        />
        <span className={styles.to}>to</span>
        <input
          type="time"
          className={styles.timeInput}
          value={minutesToHHMM(value.endMin)}
          onChange={(e) => onChange({ ...value, endMin: hhmmToMinutes(e.target.value) })}
        />
      </div>
    </div>
  );
}
