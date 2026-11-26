import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Check, Clock, EllipsisVertical, Hash, Play } from "lucide-react";
import type { TaskRowProps } from "../../types/ui";
import { Button } from "../Button";
import { DifficultyChip } from "../DifficultyChip";
import styles from "./TaskRow.module.css";

const SWIPE_DONE_PX = 96;

/** One task: a real checkbox, title, difficulty, estimate and tags. Swipe right to complete on touch. */
export function TaskRow({
  id,
  title,
  difficulty,
  minutes,
  tags = [],
  recommended = false,
  moved,
  done = false,
  onToggleDone,
  onStart,
  onMenu,
}: TaskRowProps) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch" || done || !onToggleDone) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (s.horizontal === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      s.horizontal = Math.abs(mx) > Math.abs(my);
      if (s.horizontal) e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (s.horizontal) setDx(Math.max(0, mx));
  };
  const onPointerEnd = () => {
    const s = start.current;
    start.current = null;
    if (s?.horizontal && dx >= SWIPE_DONE_PX) onToggleDone?.(id);
    setDx(0);
  };

  return (
    <div className={styles.item}>
      {dx > 0 && (
        <div className={styles.swipeBg} aria-hidden="true">
          <Check size={18} />
          Done
        </div>
      )}
      <div
        className={[styles.task, recommended && styles.rec, done && styles.done, dx > 0 && styles.dragging].filter(Boolean).join(" ")}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <span className={styles.check}>
          <input
            type="checkbox"
            checked={done}
            aria-label={`Mark ${title} ${done ? "not done" : "done"}`}
            onChange={() => onToggleDone?.(id)}
          />
          <span className={styles.box} aria-hidden="true">
            <Check size={14} />
          </span>
        </span>
        <div className={styles.main}>
          {recommended && (
            <span className={styles.flag}>
              <ArrowRight size={13} aria-hidden="true" />
              Best fit right now
            </span>
          )}
          <p className={styles.title}>{title}</p>
          <div className={styles.meta}>
            <DifficultyChip level={difficulty} />
            <span className={styles.minutes}>
              <Clock size={14} aria-hidden="true" />
              {minutes} min
            </span>
            {tags.map((t) => (
              <span key={t} className={styles.tag}>
                <Hash size={11} aria-hidden="true" />
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.side}>
          {moved ? (
            <span key={`${moved}`} className={styles.moved} title={`Moved ${moved > 0 ? "up" : "down"} ${Math.abs(moved)}`}>
              {moved > 0 ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
              {Math.abs(moved)}
              <span className="sr-only"> {moved > 0 ? "up" : "down"}</span>
            </span>
          ) : null}
          {recommended && onStart && (
            <Button size="sm" icon={Play} onClick={() => onStart(id)}>
              Start
            </Button>
          )}
          {onMenu && (
            <Button variant="ghost" size="sm" iconOnly icon={EllipsisVertical} aria-label={`More options for ${title}`} onClick={() => onMenu(id)} />
          )}
        </div>
      </div>
    </div>
  );
}
