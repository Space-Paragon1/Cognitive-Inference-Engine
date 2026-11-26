import type { ContextPillProps } from "../../types/ui";
import { CTX } from "../../lib/domain";
import styles from "./ContextPill.module.css";

type Props = Omit<ContextPillProps, "size"> & {
  /** sm in tables and the event log, md by default, lg under the mobile hero gauge. */
  size?: "sm" | "md" | "lg";
};

const ICON = { sm: 14, md: 16, lg: 18 } as const;

/** A context as colour, icon and the exact domain label. */
export function ContextPill({ context, label, size = "md", uncertain = false, plain = false }: Props) {
  const meta = CTX[context];
  const Icon = meta.icon;
  return (
    <span
      className={[styles.pill, size !== "md" && styles[size], plain && styles.plain, uncertain && styles.uncertain]
        .filter(Boolean)
        .join(" ")}
      data-ctx={context}
    >
      <Icon size={ICON[size]} aria-hidden="true" />
      {label ?? meta.label}
    </span>
  );
}
