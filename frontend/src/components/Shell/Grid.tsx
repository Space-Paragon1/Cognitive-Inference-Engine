import type { CSSProperties, ReactNode } from "react";
import styles from "./Grid.module.css";

/** 12 columns at 1024px and up, 8 on tablets, 4 on phones (handoff.md). */
export function Grid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={[styles.grid, className].filter(Boolean).join(" ")}>{children}</div>;
}

interface CellProps {
  /** Columns of 12. */
  span: number;
  /** Columns of 8 at 768–1023px. Default: 4 for spans up to 4, else the full 8 (8+4 rows stack; 4+4+4 wraps). */
  tablet?: number;
  /** Columns of 4 under 768px. Default 4 (one stack). */
  mobile?: number;
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
  "aria-labelledby"?: string;
}

export function Cell({ span, tablet, mobile = 4, children, className, as: Tag = "div", ...rest }: CellProps) {
  const style = {
    "--span": span,
    "--span-t": tablet ?? (span <= 4 ? 4 : 8),
    "--span-m": mobile,
  } as CSSProperties;
  return (
    <Tag className={[styles.cell, className].filter(Boolean).join(" ")} style={style} {...rest}>
      {children}
    </Tag>
  );
}
