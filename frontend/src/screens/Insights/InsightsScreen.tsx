/* Insights: one week at a time (Monday to Sunday). KPIs, focus per day, the context
   mix, the weekly reflection, day by day and the best hours (handoff.md:
   KPI 3 × 4 | Daily 4 · Mix 4 · Reflection 4 | Table 7 · Heatmap 5). */
import { useMemo, useState } from "react";
import { Activity, CalendarDays, ChevronLeft, ChevronRight, Gauge, History as HistoryIcon, Target, Timer } from "lucide-react";
import { hasData, useLive } from "../../live/LiveState";
import { useSettings } from "../../live/SettingsState";
import { useWeek } from "../../live/useWeek";
import { pct, pctNum } from "../../lib/format";
import { addDays, bestWindow, dateKey, dayRows, heatGrid, hours, kpis, reflection, weekLabel } from "../../lib/insights";
import type { DayRow, Kpis } from "../../lib/insights";
import { navigate } from "../../lib/router";
import type { StatTileProps } from "../../types/ui";
import { BestHours, ContextMixChart, DailyFocusChart, DayList, DayTable, WeeklyReflection } from "../../components/Analytics";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { Skeleton } from "../../components/Skeleton";
import { StatTile } from "../../components/StatsCard";
import { CHART_HEIGHT } from "../../components/ChartStyle";
import { Cell, ConnectionBanner, Grid, Page, useShell } from "../../components/Shell";
import { InsightsSwitch } from "../History/InsightsSwitch";
import styles from "./InsightsScreen.module.css";
import { LoadError } from "../../components/LoadError";

function tiles(k: Kpis | null, days: DayRow[], bestHours: string | null, th: { high: number; fatigue: number }, thisWeek: boolean, compact: boolean): StatTileProps[] {
  const empty = !k || !days.some((d) => d.sessions);
  if (empty) {
    return [
      { label: compact ? "Focus" : "Total focus time", value: "–", icon: compact ? undefined : Timer },
      { label: compact ? "Best day" : "Best focus day", value: "–", icon: compact ? undefined : CalendarDays },
      { label: compact ? "Avg load" : "Average load", value: "–", icon: compact ? undefined : Gauge },
      { label: compact ? "Efficiency" : "Focus efficiency", value: "–", icon: compact ? undefined : Target },
    ];
  }
  const vs = k.vsLastWeek;
  const than = thisWeek ? "than this time last week" : "than last week";
  const trend: StatTileProps["trend"] = vs == null ? undefined : Math.abs(vs) < 0.1 ? "flat" : vs > 0 ? "up" : "down";
  const vsText = vs == null ? "No data from last week to compare" : Math.abs(vs) < 0.1 ? `Same ${than.replace("than ", "as ")}` : `${hours(Math.abs(vs))} h ${vs > 0 ? "more" : "less"} ${than}`;
  const avg = k.avgLoad ?? 0;
  const avgText = avg >= th.fatigue ? `Mostly above your fatigue line (${pct(th.fatigue)})` : avg >= th.high ? `Often above your high line (${pct(th.high)})` : "Comfortably in range";
  const best = k.best;
  return [
    { label: compact ? "Focus" : "Total focus time", icon: compact ? undefined : Timer, value: hours(k.focusHours), unit: "h", sub: compact ? undefined : vsText, trend: compact ? undefined : trend },
    {
      label: compact ? "Best day" : "Best focus day",
      icon: compact ? undefined : CalendarDays,
      value: best ? best.short : "–",
      sub: compact || !best ? undefined : `${hours(best.focusMinutes / 60)} h${bestHours ? `, mostly ${bestHours}` : ""}`,
    },
    { label: compact ? "Avg load" : "Average load", icon: compact ? undefined : Gauge, value: String(pctNum(avg)), unit: "%", sub: compact ? undefined : avgText },
    {
      label: compact ? "Efficiency" : "Focus efficiency",
      icon: compact ? undefined : Target,
      value: String(pctNum(k.efficiency ?? 0)),
      unit: "%",
      sub: compact ? undefined : "Share of tracked time in deep focus",
    },
  ];
}

export function InsightsScreen() {
  const { layout } = useShell();
  const mobile = layout === "mobile";
  const { thresholds } = useSettings();
  const noSource = useLive((s) => !s.loading && !hasData(s.state));
  const [offset, setOffset] = useState(0);
  const week = useWeek(offset);
  const label = weekLabel(week.start);
  const startKey = dateKey(week.start);

  const view = useMemo(() => {
    if (!week.data) return null;
    const days = dayRows(week.start, week.data.stats);
    // This week is compared with the same days of last week, not the whole of it.
    const today = (new Date().getDay() + 6) % 7;
    const lastStart = addDays(week.start, -7);
    const upTo = offset === 0 ? dateKey(addDays(lastStart, today)) : dateKey(addDays(lastStart, 6));
    const last = week.data.lastWeek.filter((d) => d.date <= upTo);
    const lastFocus = week.data.lastWeek.length ? last.reduce((a, d) => a + d.focus_minutes, 0) : null;
    const k = kpis(days, lastFocus);
    const grid = heatGrid(week.data.sessions, week.start);
    const bestHours = k.best ? bestWindow(grid.minutes[k.best.index]) : null;
    return { days, k, grid, bestHours, reflection: reflection(days, grid, thresholds.high) };
  }, [week.data, startKey, offset, thresholds.high]);

  const prev = () => setOffset((o) => o - 1);
  const next = () => setOffset((o) => Math.min(0, o + 1));
  const weekButtons = (variant: "secondary" | "ghost") => (
    <>
      <Button variant={variant} iconOnly icon={ChevronLeft} aria-label="Previous week" onClick={prev} />
      <Button variant={variant} iconOnly icon={ChevronRight} aria-label="Next week" disabled={offset === 0} onClick={next} />
    </>
  );
  const banner = <ConnectionBanner />;
  const empty = view != null && !view.days.some((d) => d.sessions);
  const kpiList = tiles(view?.k ?? null, view?.days ?? [], view?.bestHours ?? null, thresholds, offset === 0, mobile);
  const fileName = `clr-week-${startKey}.csv`;

  let body;
  if (week.loading && !week.data) {
    body = (
      <Grid>
        {[0, 1, 2, 3].map((i) => (
          <Cell key={i} span={3} mobile={2}>
            <Skeleton shape="tile" />
          </Cell>
        ))}
        {[0, 1, 2].map((i) => (
          <Cell key={`c${i}`} span={4}>
            <Card aria-busy>
              <Skeleton shape="chart" height={CHART_HEIGHT.md} />
            </Card>
          </Cell>
        ))}
      </Grid>
    );
  } else if (week.error || !view) {
    body = (
      <Card>
        <LoadError
          title="Something went wrong on our side"
          body="Your data is safe. We could not load your insights just now."
          offlineWhat="Your insights load"
          onRetry={week.retry}
        />
      </Card>
    );
  } else {
    const kpiCells = kpiList.map((t) => (
      <Cell key={t.label} span={3} mobile={2}>
        <StatTile {...t} />
      </Cell>
    ));
    const emptyCard = noSource ? (
      <EmptyState
        icon={Activity}
        title="Connect a source to see your load"
        body="CLR reads how you work, not what you work on. The browser extension takes about a minute to set up."
        actions={<Button onClick={() => navigate("settings", "sources")}>Connect a source</Button>}
      />
    ) : (
      <EmptyState
        icon={HistoryIcon}
        title={offset === 0 ? "Nothing tracked this week yet" : "Nothing tracked this week"}
        body="Sessions appear here after your first 10 minutes of tracked work."
        actions={
          offset === 0 ? (
            <Button variant="secondary" onClick={prev}>
              See last week
            </Button>
          ) : undefined
        }
      />
    );

    if (empty) {
      body = (
        <Grid>
          {kpiCells}
          <Cell span={12}>
            <Card>{emptyCard}</Card>
          </Cell>
        </Grid>
      );
    } else if (mobile) {
      body = (
        <div className={styles.stack}>
          <Grid>{kpiCells}</Grid>
          <Card title="Focus time per day" titleId="daily-title">
            <DailyFocusChart days={view.days} height="sm" />
          </Card>
          <WeeklyReflection reflection={view.reflection} week={startKey} />
          <Card title="Context mix per day" titleId="mix-title">
            <ContextMixChart days={view.days} height="sm" />
          </Card>
          <BestHours grid={view.grid} compact />
          <DayList days={view.days} />
        </div>
      );
    } else {
      body = (
        <Grid>
          {kpiCells}
          <Cell span={4}>
            <Card title="Focus time per day" titleId="daily-title">
              <DailyFocusChart days={view.days} />
            </Card>
          </Cell>
          <Cell span={4}>
            <Card title="Context mix per day" titleId="mix-title">
              <ContextMixChart days={view.days} />
            </Card>
          </Cell>
          <Cell span={4}>
            <WeeklyReflection reflection={view.reflection} week={startKey} />
          </Cell>
          <Cell span={7}>
            <DayTable days={view.days} fileName={fileName} />
          </Cell>
          <Cell span={5}>
            <BestHours grid={view.grid} />
          </Cell>
        </Grid>
      );
    }
  }

  if (mobile) {
    return (
      <Page title="Insights" banner={banner}>
        <div className={styles.stack}>
          <InsightsSwitch value="week" />
          <div className={styles.weekRow}>
            <Button variant="ghost" iconOnly icon={ChevronLeft} aria-label="Previous week" onClick={prev} />
            <b aria-live="polite">{label}</b>
            <Button variant="ghost" iconOnly icon={ChevronRight} aria-label="Next week" disabled={offset === 0} onClick={next} />
          </div>
          {body}
        </div>
      </Page>
    );
  }

  return (
    <Page title="Insights" sub={<span aria-live="polite">{label}</span>} banner={banner} actions={weekButtons("secondary")}>
      {body}
    </Page>
  );
}
