import type { ReactNode } from "react";
import type { Tone } from "../../types/ui";
import { toneAttrs } from "../../lib/domain";
import styles from "./Badge.module.css";

/** A small rounded label: "Preview", "Best", "Recommended". Tinted by its tone. */
export function Badge({ children, tone = "accent" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={styles.badge} {...toneAttrs(tone)}>
      {children}
    </span>
  );
}
