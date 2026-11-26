import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";
import type { FilterChipProps, SegmentedControlProps } from "../../types/ui";
import { CTX } from "../../lib/domain";
import styles from "./SegmentedControl.module.css";

type Props<T extends string> = SegmentedControlProps<T> & {
  /** Stretch to the container width with equal segments (forms and sheets). */
  block?: boolean;
  /** Tabular numerals for numeric options (1×, 2×…). */
  numeric?: boolean;
  id?: string;
};

/** Mutually exclusive options: a radiogroup with arrow-key movement. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  block = false,
  numeric = false,
  id,
}: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next: number | null = null;
    if (e.key in keys) next = (index + keys[e.key] + options.length) % options.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = options.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      className={[styles.seg, size === "sm" && styles.sm, block && styles.block].filter(Boolean).join(" ")}
      onKeyDown={onKeyDown}
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => (refs.current[i] = el)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={i === index ? 0 : -1}
          className={[styles.option, numeric && styles.num].filter(Boolean).join(" ")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Multi-select context filter chip with icon, label, count and a check when selected. */
export function FilterChip({ label, context, selected, count, onToggle }: FilterChipProps) {
  const meta = context ? CTX[context] : null;
  const Icon = selected ? Check : meta?.icon;
  return (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={selected}
      data-ctx={context}
      onClick={onToggle}
    >
      {Icon && <Icon size={16} aria-hidden="true" />}
      {label}
      {count != null && <span className={styles.count}>{count}</span>}
    </button>
  );
}
