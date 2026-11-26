/* The event log: time, source, event, load and context, with context filter chips
   and "Export CSV". While the replay plays, the row under the playhead is marked and
   kept in view; choosing a row moves the playhead there. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { CognitiveContext } from "../../types";
import { pct } from "../../lib/format";
import { clockSeconds, contextsIn, logCsv, saveCsv } from "../../lib/history";
import type { LogRow } from "../../lib/history";
import { Button } from "../Button";
import { Card } from "../Card";
import { ContextPill } from "../ContextPill";
import { FilterChip } from "../SegmentedControl";
import { SkeletonRow } from "../Skeleton";
import { CTX } from "../../lib/domain";
import styles from "./EventLog.module.css";

interface Props {
  rows: LogRow[];
  loading: boolean;
  /** Unix time under the playhead, or null when there is no replay on screen. */
  currentT: number | null;
  playing: boolean;
  onSeek: (t: number) => void;
  /** CSV file name, e.g. "clr-session-2026-11-25-2012.csv". */
  fileName: string;
  /** "table" on desktop and tablet; "list" on phones, with no card head. */
  variant?: "table" | "list";
}

export function EventLog({ rows, loading, currentT, playing, onSeek, fileName, variant = "table" }: Props) {
  const [filter, setFilter] = useState<Set<CognitiveContext>>(new Set());
  const contexts = useMemo(() => contextsIn(rows), [rows]);
  const counts = useMemo(() => {
    const m = new Map<CognitiveContext, number>();
    rows.forEach((r) => m.set(r.context, (m.get(r.context) ?? 0) + 1));
    return m;
  }, [rows]);
  const shown = useMemo(() => (filter.size ? rows.filter((r) => filter.has(r.context)) : rows), [rows, filter]);

  let current = -1;
  if (currentT != null) for (let i = 0; i < shown.length && shown[i].t <= currentT; i++) current = i;
  const currentId = current >= 0 ? shown[current].id : null;

  const scroller = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    const box = scroller.current;
    const el = currentId ? rowRefs.current.get(currentId) : null;
    if (!playing || !box || !el) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < b.top + 40 || r.bottom > b.bottom) box.scrollTop += r.top - b.top - b.height / 2;
  }, [currentId, playing]);

  const toggle = (c: CognitiveContext) =>
    setFilter((f) => {
      const next = new Set(f);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const chips = (
    <div className={styles.chips} role="group" aria-label="Filter by context">
      <FilterChip label="All" selected={filter.size === 0} onToggle={() => setFilter(new Set())} />
      {contexts.map((c) => (
        <FilterChip key={c} label={CTX[c].label} context={c} selected={filter.has(c)} count={counts.get(c)} onToggle={() => toggle(c)} />
      ))}
    </div>
  );
  const exportBtn = (block = false) => (
    <Button variant="secondary" size={block ? "md" : "sm"} block={block} icon={Download} disabled={!shown.length} onClick={() => saveCsv(fileName, logCsv(shown))}>
      Export CSV
    </Button>
  );
  const ref = (id: string) => (el: HTMLElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  };
  const none = <p className={styles.none}>Nothing logged in {filter.size === 1 ? "this context" : "these contexts"}.</p>;

  if (loading) {
    const sk = (
      <div className={styles.skeleton} aria-busy>
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
    return variant === "list" ? sk : <Card title="Event log" titleId="event-log-title">{sk}</Card>;
  }

  if (variant === "list") {
    return (
      <div className={styles.mobile}>
        <div className={styles.chipScroll}>{chips}</div>
        <Card className={styles.listCard}>
          {shown.length ? (
            <ul className={styles.list} aria-label="Events">
              {shown.map((r) => (
                <li key={r.id}>
                  <button type="button" className={styles.item} onClick={() => onSeek(r.t)} aria-label={`${clockSeconds(r.t)}, ${r.source}: ${r.text}. Load ${pct(r.load)}, ${CTX[r.context].label}. Open in replay.`}>
                    <small>
                      {clockSeconds(r.t)} · {r.source}
                    </small>
                    <b>{r.text}</b>
                    <span className={styles.itemFoot}>
                      <ContextPill context={r.context} size="sm" />
                      <small>Load {pct(r.load)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            none
          )}
        </Card>
        {exportBtn(true)}
      </div>
    );
  }

  return (
    <Card title="Event log" titleId="event-log-title" meta={`${rows.length} event${rows.length === 1 ? "" : "s"}`}>
      <div className={styles.toolbar}>
        {chips}
        {exportBtn()}
      </div>
      {shown.length ? (
        <div className={styles.scroller} ref={scroller}>
          <table className={styles.table}>
            <caption className="sr-only">Events in this session, oldest first. Choose a time to move the replay there.</caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Source</th>
                <th scope="col">Event</th>
                <th scope="col" className={styles.num}>
                  Load
                </th>
                <th scope="col">Context</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} ref={ref(r.id)} aria-current={r.id === currentId || undefined} onClick={() => onSeek(r.t)}>
                  <td className={styles.strong}>
                    <button type="button" className={styles.seek} onClick={(e) => (e.stopPropagation(), onSeek(r.t))} aria-label={`Replay from ${clockSeconds(r.t)}`}>
                      {clockSeconds(r.t)}
                    </button>
                  </td>
                  <td>{r.source}</td>
                  <td className={styles.event}>{r.text}</td>
                  <td className={styles.num}>{pct(r.load)}</td>
                  <td>
                    <ContextPill context={r.context} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        none
      )}
    </Card>
  );
}
