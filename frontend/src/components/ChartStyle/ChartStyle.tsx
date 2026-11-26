/* The Recharts recipe from design/components/ChartStyle/README.md, in one place:
   one 0–100% y-axis, horizontal grid only, dashed thresholds, context colours read
   once from the tokens, animation off for live data, a surface-inverse tooltip, an
   aria-label summary and a "View as table" link on every chart. */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { CognitiveContext } from "../../types";
import type { ChartStyleProps } from "../../types/ui";
import { CTX, CTX_ORDER } from "../../lib/domain";
import styles from "./ChartStyle.module.css";

export const CHART_HEIGHT = { sm: 160, md: 220, lg: 280 } as const;

export interface ChartColors {
  ctx: Record<CognitiveContext, string>;
  ctxSoft: Record<CognitiveContext, string>;
  accent: string;
  grid: string;
  threshold: string;
  ink: string;
  inkSubtle: string;
  surface: string;
  heat: string[];
}

const CTX_TOKEN: Record<CognitiveContext, string> = {
  deep_focus: "deep-focus",
  shallow_work: "shallow-work",
  stuck: "stuck",
  fatigue: "fatigue",
  recovering: "recovering",
  unknown: "unknown",
};

function readColors(): ChartColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const ctx = {} as Record<CognitiveContext, string>;
  const ctxSoft = {} as Record<CognitiveContext, string>;
  CTX_ORDER.forEach((k) => {
    ctx[k] = v(`--ctx-${CTX_TOKEN[k]}-chart`);
    ctxSoft[k] = v(`--ctx-${CTX_TOKEN[k]}-soft`);
  });
  return {
    ctx,
    ctxSoft,
    accent: v("--accent"),
    grid: v("--chart-grid"),
    threshold: v("--chart-threshold"),
    ink: v("--ink"),
    inkSubtle: v("--ink-subtle"),
    surface: v("--surface"),
    heat: [0, 1, 2, 3, 4].map((i) => v(`--heat-${i}`)),
  };
}

/** Token colours for Recharts props, read once and again when the theme changes. */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState(readColors);
  useEffect(() => {
    const obs = new MutationObserver(() => setColors(readColors()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return colors;
}

/** Shared axis props: caption ticks in ink-subtle, no axis lines. */
export function axisProps(c: ChartColors) {
  return {
    axisLine: false,
    tickLine: false,
    tick: { fill: c.inkSubtle, fontSize: 12 },
  } as const;
}

/** Horizontal gridlines only. */
export function gridProps(c: ChartColors) {
  return { stroke: c.grid, strokeWidth: 1, vertical: false } as const;
}

/** Dashed threshold line props with a right-edge label ("High 70%"). The high and
    fatigue lines sit close together, so label the lower one under its line. */
export function thresholdProps(c: ChartColors, label: string, below = false) {
  return {
    stroke: c.threshold,
    strokeDasharray: "4 4",
    strokeWidth: 1,
    ifOverflow: "extendDomain" as const,
    label: { value: label, position: below ? ("insideTopRight" as const) : ("insideBottomRight" as const), fill: c.inkSubtle, fontSize: 11, fontWeight: 500 },
  };
}

/** The tooltip card: time, the bold value and an optional context. */
export function ChartTooltipCard({ title, value, context }: { title: string; value: string; context?: CognitiveContext }) {
  const Icon = context ? CTX[context].icon : null;
  return (
    <div className={styles.tooltip}>
      <span>{title}</span>
      <b>{value}</b>
      {context && Icon && (
        <span>
          <Icon size={12} aria-hidden="true" />
          {CTX[context].label}
        </span>
      )}
    </div>
  );
}

/** Context legend: icon, label and an optional share. Contexts are always named, never colour alone. */
export function ContextLegend({ contexts, shares }: { contexts: CognitiveContext[]; shares?: Partial<Record<CognitiveContext, number>> }) {
  return (
    <ul className={styles.legend}>
      {contexts.map((k) => {
        const Icon = CTX[k].icon;
        return (
          <li key={k} data-ctx={k}>
            <Icon size={14} aria-hidden="true" />
            {CTX[k].label}
            {shares?.[k] != null && <b>{Math.round((shares[k] ?? 0) * 100)}%</b>}
          </li>
        );
      })}
    </ul>
  );
}

export interface TableColumn<Row> {
  key: string;
  label: string;
  numeric?: boolean;
  strong?: boolean;
  render: (row: Row) => ReactNode;
}

export function DataTable<Row>({ columns, rows, caption, rowKey }: { columns: TableColumn<Row>[]; rows: Row[]; caption: string; rowKey: (row: Row, i: number) => string }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.numeric ? styles.numCell : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey(r, i)}>
              {columns.map((c) => (
                <td key={c.key} className={[c.numeric && styles.numCell, c.strong && styles.strong].filter(Boolean).join(" ") || undefined}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type FrameProps = Pick<ChartStyleProps, "ariaLabel" | "height"> & {
  children: ReactNode;
  /** Table view of the same data. */
  table?: ReactNode;
  legend?: ReactNode;
};

/** Chart wrapper: role="img" with the summary, then the legend and a "View as table" toggle. */
export function ChartFrame({ ariaLabel, height = "md", children, table, legend }: FrameProps) {
  const [asTable, setAsTable] = useState(false);
  return (
    <div className={styles.frame}>
      {asTable && table ? (
        table
      ) : (
        <div className={styles.chart} style={{ height: CHART_HEIGHT[height] }} role="img" aria-label={ariaLabel}>
          {children}
        </div>
      )}
      {(legend || table) && (
        <div className={styles.foot}>
          {legend && !asTable ? legend : <span />}
          {table && (
            <button type="button" className={styles.link} aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
              {asTable ? "View as chart" : "View as table"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
