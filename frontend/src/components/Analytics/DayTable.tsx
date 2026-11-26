/* Day by day: a table on wider screens and one row per day (with a mini ring) on phones. */
import { Download } from "lucide-react";
import { CTX } from "../../lib/domain";
import { pct } from "../../lib/format";
import { hours, weekCsv } from "../../lib/insights";
import type { DayRow } from "../../lib/insights";
import { saveCsv } from "../../lib/history";
import { Badge } from "../Badge";
import { Button } from "../Button";
import { Card } from "../Card";
import { ContextPill } from "../ContextPill";
import { DataTable } from "../ChartStyle";
import { LoadGauge } from "../LoadGauge";
import styles from "./DayTable.module.css";

interface Props {
  days: DayRow[];
  /** CSV name, e.g. "clr-week-2026-11-23.csv". */
  fileName: string;
}

function bestOf(days: DayRow[]) {
  return days.reduce<DayRow | null>((b, d) => (d.focusMinutes > (b?.focusMinutes ?? 0) ? d : b), null);
}

export function DayTable({ days, fileName }: Props) {
  const best = bestOf(days);
  const dash = (d: DayRow, v: string) => (d.sessions ? v : "–");
  return (
    <Card
      title="Day by day"
      titleId="day-table-title"
      meta={
        <Button variant="ghost" size="sm" icon={Download} onClick={() => saveCsv(fileName, weekCsv(days))}>
          Export CSV
        </Button>
      }
    >
      <DataTable
        caption="Focus, sessions and load for each day this week"
        rowKey={(d) => d.date}
        rows={days}
        columns={[
          {
            key: "day",
            label: "Day",
            strong: true,
            render: (d) => (
              <span className={styles.day}>
                {d.short}
                {best && d.index === best.index && <Badge>Best</Badge>}
              </span>
            ),
          },
          { key: "focus", label: "Focus", numeric: true, render: (d) => dash(d, `${hours(d.focusMinutes / 60)} h`) },
          { key: "sessions", label: "Sessions", numeric: true, render: (d) => dash(d, String(d.sessions)) },
          { key: "avg", label: "Avg load", numeric: true, render: (d) => dash(d, pct(d.avgLoad ?? 0)) },
          { key: "peak", label: "Peak", numeric: true, render: (d) => dash(d, pct(d.peak ?? 0)) },
          { key: "top", label: "Mostly", render: (d) => (d.top ? <ContextPill context={d.top} size="sm" /> : <span className={styles.none}>–</span>) },
        ]}
      />
    </Card>
  );
}

export function DayList({ days }: { days: DayRow[] }) {
  const best = bestOf(days);
  const shown = days.filter((d) => !d.future || d.sessions);
  return (
    <Card className={styles.listCard}>
      <ul className={styles.list} aria-label="Day by day">
        {shown
          .slice()
          .reverse()
          .map((d) => (
            <li key={d.date} className={styles.row}>
              <span aria-hidden="true" className={styles.ring}>
                <LoadGauge variant="mini" size={36} load={d.avgLoad} context={d.top ?? "unknown"} confidence={1} showNumber={false} />
              </span>
              <span className={styles.text}>
                <b>
                  {d.long}
                  {best && d.index === best.index ? " · best" : ""}
                </b>
                <small>
                  {d.sessions
                    ? `${hours(d.focusMinutes / 60)} h focus · ${d.sessions} session${d.sessions === 1 ? "" : "s"} · avg ${pct(d.avgLoad ?? 0)}${d.top ? ` · mostly ${CTX[d.top].label.toLowerCase()}` : ""}`
                    : "No sessions"}
                </small>
              </span>
            </li>
          ))}
      </ul>
    </Card>
  );
}
