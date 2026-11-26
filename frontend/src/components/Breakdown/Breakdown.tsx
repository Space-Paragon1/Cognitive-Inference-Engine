import type { CSSProperties } from "react";
import type { BreakdownProps } from "../../types/ui";
import { BREAKDOWN } from "../../lib/domain";
import { useTween } from "../../hooks/useTween";
import styles from "./Breakdown.module.css";

type Props = Partial<Pick<BreakdownProps, "intrinsic" | "extraneous" | "germane">> &
  Pick<BreakdownProps, "compact" | "uncertain"> & {
    /** No data yet: empty tracks and a dash. */
    empty?: boolean;
  };

const KEYS = ["intrinsic", "extraneous", "germane"] as const;

/** Intrinsic, extraneous and germane bars, each explained in plain words. */
export function Breakdown({ compact = false, uncertain = false, empty = false, ...values }: Props) {
  return (
    <div className={[styles.breakdown, compact && styles.compact, uncertain && styles.uncertain].filter(Boolean).join(" ")}>
      {uncertain && !empty && (
        <div className={styles.head}>
          <span className={styles.overline}>Breakdown</span>
          <span className={styles.rough}>Rough</span>
        </div>
      )}
      {KEYS.map((k) => (
        <Row key={k} k={k} value={empty ? null : values[k] ?? 0} />
      ))}
    </div>
  );
}

function Row({ k, value }: { k: (typeof KEYS)[number]; value: number | null }) {
  const b = BREAKDOWN[k];
  const shown = useTween(value == null ? null : Math.max(0, Math.min(1, value)));
  const v = shown == null ? null : Math.round(shown * 100);
  const target = value == null ? null : Math.round(value * 100);
  const short = b.desc.split(":")[0].toLowerCase();
  return (
    <div className={styles.row} style={{ "--bar": b.token } as CSSProperties}>
      <span className={styles.name}>
        <i aria-hidden="true" />
        {b.label}
      </span>
      <span className={styles.val} aria-hidden="true">
        {v == null ? "–" : `${v}%`}
      </span>
      <span
        className={styles.bar}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={target ?? undefined}
        aria-valuetext={target == null ? `${b.label}: no data yet` : `${b.label} ${target} percent: ${short}`}
      >
        <span style={{ width: `${v ?? 0}%` }} />
      </span>
      <span className={styles.desc}>{b.desc}</span>
    </div>
  );
}
