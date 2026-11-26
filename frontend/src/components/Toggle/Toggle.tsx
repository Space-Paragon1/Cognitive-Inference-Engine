import { useId } from "react";
import { Check } from "lucide-react";
import type { ToggleProps } from "../../types/ui";
import styles from "./Toggle.module.css";

/** On/off switch with a check in the thumb, so state is never colour alone. */
export function Toggle({ checked, onChange, label, description, row = false, disabled = false }: ToggleProps) {
  const id = useId();
  const visual = (
    <span className={styles.track} aria-hidden={row || undefined}>
      <span className={styles.thumb}>
        <Check size={14} aria-hidden="true" />
      </span>
    </span>
  );

  if (!row) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={styles.switch}
        onClick={() => onChange(!checked)}
      >
        {visual}
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={description ? `${id}-desc` : undefined}
      disabled={disabled}
      className={styles.row}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.text}>
        <span id={`${id}-label`} className={styles.label}>
          {label}
        </span>
        {description && (
          <span id={`${id}-desc`} className={styles.desc}>
            {description}
          </span>
        )}
      </span>
      {visual}
    </button>
  );
}
