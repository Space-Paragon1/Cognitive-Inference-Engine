import { useEffect, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";
import type { DirectiveCardProps, DirectivesFeedProps } from "../../types/ui";
import { DIRECTIVES, toneAttrs } from "../../lib/domain";
import { useFlip } from "../../hooks/useFlip";
import { Button } from "../Button";
import { EmptyState } from "../EmptyState";
import styles from "./DirectiveCard.module.css";

/** One thing CLR is doing for you right now, with the reason in plain words. */
export function DirectiveCard({
  type,
  reason,
  label,
  meta,
  action,
  isNew,
  leaving,
}: DirectiveCardProps & { leaving?: boolean }) {
  const d = DIRECTIVES[type];
  const Icon = d.icon;
  return (
    <div
      className={[styles.card, isNew && styles.isNew, leaving && styles.leaving].filter(Boolean).join(" ")}
      {...toneAttrs(d.tone)}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon size={20} />
      </span>
      <div>
        <p className={styles.title}>{label ?? d.label}</p>
        <p className={styles.reason}>
          {reason}
          {meta && <span className={styles.meta}> · {meta}</span>}
        </p>
      </div>
      {action && (
        <Button variant="ghost" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

type FeedProps = DirectivesFeedProps & {
  /** Show at most this many; the rest go behind "View all". Default 4 (Now). */
  limit?: number;
  onViewAll?: () => void;
};

type Rendered = DirectiveCardProps & { leaving?: boolean };

/** "What CLR is doing": directives sorted by priority, diffed by type, with FLIP moves. */
export function DirectivesFeed({ directives, bare = false, limit = 4, onViewAll }: FeedProps) {
  const [items, setItems] = useState<Rendered[]>(directives);
  const list = useRef<HTMLUListElement>(null);
  const [announce, setAnnounce] = useState("");
  const seen = useRef(new Set(directives.map((d) => d.type)));

  // Keep removed cards for one fade, then drop them.
  useEffect(() => {
    const nextTypes = new Set(directives.map((d) => d.type));
    setItems((prev) => {
      const leaving = prev.filter((p) => !nextTypes.has(p.type)).map((p) => ({ ...p, leaving: true }));
      return [...directives, ...leaving];
    });
    const added = directives.filter((d) => !seen.current.has(d.type));
    if (added.length) {
      const d = added[0];
      setAnnounce(`${d.label ?? DIRECTIVES[d.type].label}: ${d.reason.replace(/\.$/, "").toLowerCase()}`);
    }
    seen.current = nextTypes;
    const t = window.setTimeout(() => setItems((prev) => prev.filter((p) => !p.leaving)), 240);
    return () => window.clearTimeout(t);
  }, [directives]);

  const visible = items.slice(0, limit + items.filter((i) => i.leaving).length);
  const active = directives.length;
  useFlip(list, visible.map((v) => v.type).join("|"));

  const body =
    active === 0 && items.length === 0 ? (
      <EmptyState
        compact
        icon={CircleCheck}
        tone="positive"
        title="All clear"
        body="Nothing needs adjusting right now. CLR will step in if your load changes."
        level={4}
      />
    ) : (
      <>
        <ul className={styles.feed} ref={list}>
          {visible.map((d) => (
            <li key={d.type} data-flip-key={d.type}>
              <DirectiveCard {...d} />
            </li>
          ))}
        </ul>
        {active > limit && onViewAll && (
          <Button variant="ghost" size="sm" className={styles.more} onClick={onViewAll}>
            View all {active}
          </Button>
        )}
      </>
    );

  return (
    <section className={bare ? undefined : styles.chrome} aria-labelledby="directives-title">
      <div className={styles.head}>
        <h3 id="directives-title" className={styles.cardTitle}>
          What CLR is doing
        </h3>
        {active > 0 && <span className={styles.count}>{active} active</span>}
      </div>
      {body}
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </section>
  );
}
