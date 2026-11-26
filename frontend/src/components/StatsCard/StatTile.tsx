import { Fragment } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ContextBarProps, StatTileProps } from "../../types/ui";
import { CTX, CTX_ORDER } from "../../lib/domain";
import styles from "./StatTile.module.css";

/** Split "1 h 48 m" into numbers and small unit letters. */
function renderValue(value: string) {
  const parts = value.match(/[\d.,–-]+|[^\d.,–\s-]+|\s+/g) ?? [value];
  return parts.map((p, i) =>
    /^[^\d.,–\s-]+$/.test(p) ? <small key={i}>{p}</small> : /^\s+$/.test(p) ? <Fragment key={i}> </Fragment> : <Fragment key={i}>{p}</Fragment>
  );
}

function spokenUnit(unit?: string) {
  if (!unit) return "";
  if (unit.trim() === "%") return " percent";
  if (unit.trim() === "h") return " hours";
  if (unit.trim() === "min") return " minutes";
  return ` ${unit.trim()}`;
}

/** StatsCard: a KPI tile. Trends show direction only, never red or green. */
export function StatTile({ label, value, unit, icon: Icon, sub, trend, plain = false }: StatTileProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : trend === "flat" ? Minus : null;
  const spoken = `${label}, ${value.replace(/\bh\b/g, "hours").replace(/\bm\b/g, "minutes")}${spokenUnit(unit)}`;
  const isEmpty = value === "–";
  return (
    <div className={[styles.stat, plain && styles.plain].filter(Boolean).join(" ")} role="group" aria-label={isEmpty ? `${label}, no data yet` : spoken}>
      <span className={styles.label} aria-hidden="true">
        {Icon && <Icon size={16} aria-hidden="true" />}
        {label}
      </span>
      <span className={[styles.value, isEmpty && styles.dim].filter(Boolean).join(" ")} aria-hidden="true">
        {renderValue(value)}
        {unit && <small>{unit}</small>}
      </span>
      {sub && (
        <span className={styles.sub}>
          {TrendIcon && <TrendIcon size={14} aria-hidden="true" />}
          {sub}
        </span>
      )}
    </div>
  );
}

/** Share of time per context, in the fixed order, always with a legend (or an aria summary when hidden). */
export function ContextBar({ distribution, legend = true }: ContextBarProps) {
  const keys = CTX_ORDER.filter((k) => (distribution[k] ?? 0) > 0);
  const total = keys.reduce((a, k) => a + (distribution[k] ?? 0), 0) || 1;
  const share = (k: (typeof keys)[number]) => Math.round(((distribution[k] ?? 0) / total) * 100);
  const summary = keys.length ? keys.map((k) => `${CTX[k].label} ${share(k)} percent`).join(", ") : "No tracked time yet";
  return (
    <div>
      <div className={styles.bar} role="img" aria-label={summary}>
        {keys.length ? (
          keys.map((k) => <span key={k} data-ctx={k} style={{ flex: distribution[k] }} />)
        ) : (
          <span className={styles.empty} />
        )}
      </div>
      {legend && keys.length > 0 && (
        <ul className={styles.legend} aria-hidden="true">
          {keys.map((k) => {
            const Icon = CTX[k].icon;
            return (
              <li key={k} data-ctx={k}>
                <Icon size={14} aria-hidden="true" />
                {CTX[k].label} <b>{share(k)}%</b>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
