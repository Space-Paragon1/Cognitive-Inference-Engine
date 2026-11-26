import { BookOpen } from "lucide-react";
import type { DifficultyChipProps } from "../../types/ui";
import { DIFFICULTY } from "../../lib/domain";
import styles from "./DifficultyChip.module.css";

/** Difficulty as shape plus a word: 1–3 bars, or a book for review. */
export function DifficultyChip({ level, size = "sm" }: DifficultyChipProps) {
  const d = DIFFICULTY[level] ?? DIFFICULTY.medium;
  return (
    <span className={[styles.chip, size === "md" && styles.md, level === "hard" && styles.hard].filter(Boolean).join(" ")}>
      {d.bars ? (
        <span className={styles.bars} aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <i key={n} className={n <= d.bars ? styles.on : undefined} />
          ))}
        </span>
      ) : (
        <BookOpen size={13} aria-hidden="true" />
      )}
      {d.label}
    </span>
  );
}
