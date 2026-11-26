import { useId } from "react";
import type { KeyboardEvent } from "react";
import type { SliderProps } from "../../types/ui";
import styles from "./Slider.module.css";

type Props = SliderProps & {
  /** Fires on release (pointer up, key up): save here, not on every drag event. */
  onCommit?: (value: number) => void;
};

function spoken(unit: string) {
  const u = unit.trim();
  if (u === "%") return " percent";
  if (u === "min") return " minutes";
  return u ? ` ${u}` : "";
}

/** Settings slider with a default tick, reset link and a hatched range it can't enter. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  defaultValue,
  blockBelow,
  help,
  onChange,
  onReset,
  onCommit,
}: Props) {
  const id = useId();
  const pct = (v: number) => `${(((v - min) / (max - min)) * 100).toFixed(2)}%`;
  const floor = blockBelow != null ? Math.max(min, blockBelow) : min;
  const clamp = (v: number) => Math.min(max, Math.max(floor, v));
  const changed = value !== defaultValue;

  const set = (v: number) => {
    const next = clamp(v);
    if (next !== value) onChange(next);
    return next;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const next = set(value + (e.key === "PageUp" ? 5 : -5) * step);
      onCommit?.(next);
    }
  };

  return (
    <div className={styles.slider}>
      <div className={styles.top}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <span className={styles.value} aria-hidden="true">
          {value}
          {unit}
        </span>
      </div>
      <div className={styles.track}>
        <span className={styles.rail} />
        <span className={styles.fill} style={{ width: pct(value) }} />
        {blockBelow != null && <span className={styles.blocked} style={{ width: pct(blockBelow) }} />}
        <span className={styles.tick} style={{ left: pct(defaultValue) }} title="Default" />
        <input
          id={id}
          type="range"
          className={styles.input}
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={`${label} ${value}${spoken(unit)}`}
          aria-describedby={`${id}-foot`}
          onChange={(e) => set(Number(e.target.value))}
          onPointerUp={(e) => onCommit?.(clamp(Number((e.target as HTMLInputElement).value)))}
          onKeyUp={(e) => {
            if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") onCommit?.(value);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <div className={styles.scale} aria-hidden="true">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
      <div className={styles.foot}>
        <span id={`${id}-foot`}>
          {help ? `${help} ` : ""}
          <span className={styles.default}>
            Default {defaultValue}
            {unit}
          </span>
        </span>
        {changed && onReset && (
          <button type="button" className={styles.reset} onClick={onReset}>
            Reset to default
          </button>
        )}
      </div>
    </div>
  );
}
