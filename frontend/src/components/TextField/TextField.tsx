import { useId, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { CircleAlert, CircleCheck, Eye, EyeOff } from "lucide-react";
import type { TextFieldProps } from "../../types/ui";
import styles from "./TextField.module.css";

type Props = TextFieldProps & {
  id?: string;
  name?: string;
  required?: boolean;
  autoFocus?: boolean;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  min?: number;
  max?: number;
  /** 0–4 bars under a new-password field (create and reset only). */
  strength?: number;
  onBlur?: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
};

/** Labelled input with icon, help, inline error, valid state and password reveal. */
export function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  icon: Lead,
  error,
  valid = false,
  help,
  aside,
  textarea = false,
  autoComplete,
  id: idProp,
  name,
  required,
  autoFocus,
  inputMode,
  min,
  max,
  strength,
  onBlur,
  onKeyDown,
}: Props) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const helpId = `${id}-help`;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const message = error ?? help;
  const state = error ? styles.error : valid ? styles.valid : "";

  const common = {
    id,
    name,
    value,
    placeholder,
    required,
    autoFocus,
    autoComplete,
    onBlur,
    onKeyDown,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": message ? helpId : undefined,
  };

  return (
    <div className={[styles.field, state].filter(Boolean).join(" ")}>
      <div className={styles.labelRow}>
        <label htmlFor={id}>{label}</label>
        {aside}
      </div>
      <div className={styles.wrap}>
        {Lead && !textarea && <Lead size={18} className={styles.lead} aria-hidden="true" />}
        {textarea ? (
          <textarea
            {...common}
            className={[styles.input, styles.textarea].join(" ")}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            {...common}
            type={isPassword && reveal ? "text" : type}
            inputMode={inputMode}
            min={min}
            max={max}
            className={[styles.input, Lead && styles.hasLead, isPassword && styles.hasTrail].filter(Boolean).join(" ")}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {isPassword && (
          <button
            type="button"
            className={styles.trail}
            aria-label={reveal ? "Hide password" : "Show password"}
            aria-pressed={reveal}
            onClick={() => setReveal((r) => !r)}
          >
            {reveal ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        )}
      </div>
      {message && (
        <span id={helpId} className={styles.help} role={error ? "alert" : undefined}>
          {error ? (
            <CircleAlert size={16} aria-hidden="true" />
          ) : valid ? (
            <CircleCheck size={16} aria-hidden="true" />
          ) : null}
          {message}
        </span>
      )}
      {strength != null && (
        <span className={styles.strength} data-tone={strength <= 1 ? "critical" : strength === 2 ? "caution" : "positive"} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < strength ? styles.on : undefined} />
          ))}
        </span>
      )}
    </div>
  );
}
