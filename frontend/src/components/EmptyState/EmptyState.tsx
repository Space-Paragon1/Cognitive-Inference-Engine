import { Info } from "lucide-react";
import type { EmptyStateProps } from "../../types/ui";
import { toneAttrs } from "../../lib/domain";
import styles from "./EmptyState.module.css";

type Props = EmptyStateProps & {
  /** Heading level for the title, to fit its container. Default h3. */
  level?: 2 | 3 | 4;
};

/** An invitation, never an error: icon tile, title, a line or two, and the next step. */
export function EmptyState({ title, body, icon: Icon = Info, tone = "accent", context, actions, compact = false, level = 3 }: Props) {
  const Heading = `h${level}` as "h2" | "h3" | "h4";
  return (
    <div className={[styles.empty, compact && styles.compact].filter(Boolean).join(" ")} {...toneAttrs(tone, context)}>
      <span className={styles.art} aria-hidden="true">
        <Icon size={compact ? 24 : 30} />
      </span>
      <Heading className={styles.title}>{title}</Heading>
      {body && <p className={styles.body}>{body}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
