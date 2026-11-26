/* What CLR reads and what it never reads (voice.md, ScreenOnboarding step 2). One
   source of truth for onboarding, the sign-up terms sheet and More → Help. */
import { Check, X } from "lucide-react";
import styles from "./PrivacyPromise.module.css";

export const READS = [
  "Tab and window switches (counts, not page content)",
  "Typing rhythm and pauses",
  "Compile errors and their frequency",
  "Idle time and scrolling",
  "LMS page visits (if you connect it)",
];

export const NEVER_READS = ["What you type", "Text on any page", "Your files or code", "Grades, messages or passwords", "Your camera or microphone"];

export function PrivacyPromise({ flat = false }: { flat?: boolean }) {
  return (
    <div className={[styles.lists, flat && styles.flat].filter(Boolean).join(" ")}>
      <section className={styles.card} aria-labelledby="pp-reads">
        <h2 id="pp-reads" className={styles.overline}>
          Collected
        </h2>
        <ul>
          {READS.map((t) => (
            <li key={t} data-tone="positive">
              <Check size={18} aria-hidden="true" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.card} aria-labelledby="pp-never">
        <h2 id="pp-never" className={styles.overline}>
          Never collected
        </h2>
        <ul>
          {NEVER_READS.map((t) => (
            <li key={t} className={styles.never}>
              <X size={18} aria-hidden="true" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
