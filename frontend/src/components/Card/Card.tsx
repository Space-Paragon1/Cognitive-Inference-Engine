import type { ReactNode } from "react";
import styles from "./Card.module.css";

interface Props {
  title?: ReactNode;
  /** Small text or a link on the right of the head. */
  meta?: ReactNode;
  titleId?: string;
  /** Heading level for the title. Default 2 (the page title is the h1). */
  level?: 2 | 3;
  /** No padding (charts and tables that run to the edge). */
  flush?: boolean;
  className?: string;
  children: ReactNode;
  as?: "section" | "div";
  "aria-busy"?: boolean;
}

/** The surface every screen is built from: 16px radius, 1px line, 20px padding. */
export function Card({ title, meta, titleId, level = 2, flush, className, children, as: Tag = "section", ...rest }: Props) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <Tag className={[styles.card, flush && styles.flush, className].filter(Boolean).join(" ")} aria-labelledby={title ? titleId : undefined} {...rest}>
      {(title || meta) && (
        <div className={styles.head}>
          {title && (
            <H className={styles.title} id={titleId}>
              {title}
            </H>
          )}
          {meta && <div className={styles.meta}>{meta}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}
