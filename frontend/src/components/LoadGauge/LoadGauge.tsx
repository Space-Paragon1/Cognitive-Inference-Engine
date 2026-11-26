import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { CognitiveContext } from "../../types";
import type { ConnectionState, LoadGaugeProps } from "../../types/ui";
import { CTX } from "../../lib/domain";
import { clock } from "../../lib/format";
import { useTween } from "../../hooks/useTween";
import { ContextPill } from "../ContextPill";
import styles from "./LoadGauge.module.css";

type Props = LoadGaugeProps & {
  /** Connection state: anything but live dims the gauge to 60%; offline greys the arc. */
  status?: ConnectionState;
  /** When the last reading arrived, shown as "Last reading 9:58 pm" while stale. */
  lastReadingAt?: number | null;
  /** Hide the context pill under the hero number (the popup puts it beside the ring). */
  showPill?: boolean;
  /** Mini ring: show the number inside. Default true at 40px and up. */
  showNumber?: boolean;
  /** Pill variant: make it a button (the mobile top bar opens Now). */
  onClick?: () => void;
};

const DEFAULT_THRESHOLDS = { high: 0.7, fatigue: 0.85 };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function gaugeValueText(load: number | null, context: CognitiveContext, confidence: number): string {
  if (load == null) return "No load data yet. Connect a source.";
  return `Load ${Math.round(load * 100)} percent, ${CTX[context].label.toLowerCase()}, confidence ${Math.round(confidence * 100)} percent`;
}

/** The live load gauge: hero arc, mini ring or top-bar pill. Mount once and feed it every tick. */
export function LoadGauge(props: Props) {
  const variant = props.variant ?? "hero";
  if (variant === "mini") return <MiniRing {...props} />;
  if (variant === "pill") return <LoadPill {...props} />;
  return <HeroGauge {...props} />;
}

function HeroGauge({
  load,
  context,
  confidence,
  size = 280,
  thresholds = DEFAULT_THRESHOLDS,
  caption,
  status = "live",
  lastReadingAt,
  showPill = true,
}: Props) {
  const maskId = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const shown = useTween(load == null ? null : clamp01(load));
  const empty = load == null;
  const uncertain = !empty && confidence < 0.5;
  const stale = !empty && status !== "live";
  const sw = 12;
  const dash = `${(75 * (shown ?? 0)).toFixed(2)} 100`;
  const pctShown = Math.round((shown ?? 0) * 100);
  const announcement = useGaugeAnnouncement(load, context, thresholds);

  const circle = (className: string | undefined, extra: Record<string, string | number>) => (
    <circle
      className={className}
      cx="100"
      cy="100"
      r="84"
      fill="none"
      pathLength={100}
      transform="rotate(135 100 100)"
      strokeLinecap="round"
      {...extra}
    />
  );

  const ticks = [thresholds.high, thresholds.fatigue].map((t) => {
    const a = ((135 + 270 * t) * Math.PI) / 180;
    const r1 = 84 + sw / 2 + 5;
    const r2 = r1 + 7;
    return (
      <line
        key={t}
        className={styles.tick}
        x1={(100 + r1 * Math.cos(a)).toFixed(1)}
        y1={(100 + r1 * Math.sin(a)).toFixed(1)}
        x2={(100 + r2 * Math.cos(a)).toFixed(1)}
        y2={(100 + r2 * Math.sin(a)).toFixed(1)}
      />
    );
  });

  const classes = [
    styles.gauge,
    uncertain && styles.uncertain,
    empty && styles.empty,
    stale && styles.stale,
    status === "offline" && styles.offline,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.heroWrap}>
      <div
        className={classes}
        data-ctx={context}
        style={{ "--g": `${size}px`, width: size, height: size } as CSSProperties}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={load == null ? undefined : Math.round(clamp01(load) * 100)}
        aria-valuetext={gaugeValueText(load, context, confidence)}
        aria-label="Cognitive load"
      >
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <mask id={maskId}>
              {circle(undefined, { stroke: "white", strokeWidth: sw + 6, strokeDasharray: dash })}
            </mask>
          </defs>
          {circle(styles.track, { strokeWidth: sw, strokeDasharray: "75 100" })}
          {!empty && circle(styles.halo, { strokeWidth: sw + 10, strokeDasharray: dash })}
          {!empty && circle(styles.arc, { strokeWidth: sw, strokeDasharray: dash })}
          {!empty && circle(styles.dots, { strokeWidth: sw * 0.7, strokeDasharray: "0.001 3.2", mask: `url(#${maskId})` })}
          {ticks}
        </svg>
        <div className={styles.center}>
          {empty ? (
            <>
              <div className={styles.num}>
                <span>–</span>
              </div>
              <div className={styles.cap}>no data yet</div>
            </>
          ) : (
            <>
              <div className={styles.num}>
                <span>
                  {uncertain ? "≈" : ""}
                  {pctShown}
                </span>
                <small>%</small>
              </div>
              <div className={styles.cap}>{uncertain ? "rough estimate" : caption ?? "load"}</div>
            </>
          )}
        </div>
        {showPill && !empty && (
          <div className={styles.foot}>
            <ContextPill context={context} size={size < 220 ? "sm" : "md"} uncertain={uncertain} />
          </div>
        )}
      </div>
      {stale && lastReadingAt != null && <span className={styles.staleNote}>Last reading {clock(lastReadingAt)}</span>}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

/** Speaks only when the context changes or load crosses a threshold, never every tick. */
function useGaugeAnnouncement(load: number | null, context: CognitiveContext, thresholds: { high: number; fatigue: number }) {
  const [text, setText] = useState("");
  const prev = useRef<{ context: CognitiveContext; band: number } | null>(null);
  const band = load == null ? -1 : load >= thresholds.fatigue ? 2 : load >= thresholds.high ? 1 : 0;
  useEffect(() => {
    const p = prev.current;
    prev.current = { context, band };
    if (!p || load == null) return;
    if (p.context !== context) setText(`Context: ${CTX[context].label}`);
    else if (p.band !== band && p.band !== -1) {
      const v = Math.round(load * 100);
      if (band === 2) setText(`Load ${v} percent, above your fatigue threshold`);
      else if (band === 1) setText(p.band < 1 ? `Load ${v} percent, above your high-load threshold` : `Load easing, ${v} percent`);
      else setText(`Load ${v} percent, back in your normal range`);
    }
  }, [context, band, load]);
  return text;
}

function MiniRing({ load, context, confidence, size = 40, status = "live", showNumber }: Props) {
  const shown = useTween(load == null ? null : clamp01(load));
  const empty = load == null;
  const uncertain = !empty && confidence < 0.5;
  const sw = size <= 24 ? 4 : 5;
  const num = showNumber ?? size >= 40;
  return (
    <span
      className={[styles.gauge, styles.mini, status !== "live" && !empty && styles.stale, status === "offline" && styles.offline]
        .filter(Boolean)
        .join(" ")}
      data-ctx={empty ? "unknown" : context}
      style={{ "--g": `${size}px`, width: size, height: size } as CSSProperties}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={load == null ? undefined : Math.round(clamp01(load) * 100)}
      aria-valuetext={gaugeValueText(load, context, confidence)}
      aria-label="Cognitive load"
    >
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle className={styles.track} cx="24" cy="24" r="20" fill="none" strokeWidth={sw} />
        {!empty && (
          <circle
            className={[styles.arc, uncertain && styles.miniUncertain].filter(Boolean).join(" ")}
            cx="24"
            cy="24"
            r="20"
            fill="none"
            strokeWidth={sw}
            pathLength={100}
            strokeDasharray={uncertain ? undefined : `${((shown ?? 0) * 100).toFixed(1)} 100`}
            strokeLinecap="round"
            transform="rotate(-90 24 24)"
          />
        )}
      </svg>
      {num && (
        <span className={styles.center}>
          <span className={styles.num}>{empty ? "–" : Math.round((shown ?? 0) * 100)}</span>
        </span>
      )}
    </span>
  );
}

function LoadPill({ load, context, confidence, status = "live", onClick }: Props) {
  const shown = useTween(load == null ? null : clamp01(load));
  const empty = load == null;
  const Icon = CTX[empty ? "unknown" : context].icon;
  const content = (
    <>
      <MiniRing load={load} context={context} confidence={confidence} size={22} showNumber={false} status={status} variant="mini" />
      <span aria-hidden="true">{empty ? "–" : `${confidence < 0.5 ? "≈" : ""}${Math.round((shown ?? 0) * 100)}%`}</span>
      <Icon size={16} aria-hidden="true" />
    </>
  );
  const className = [styles.pill, status !== "live" && !empty && styles.stale].filter(Boolean).join(" ");
  const label = `${gaugeValueText(load, context, confidence)}${onClick ? ". Open Now" : ""}`;
  if (onClick) {
    return (
      <button type="button" className={className} data-ctx={empty ? "unknown" : context} aria-label={label} onClick={onClick}>
        {content}
      </button>
    );
  }
  return (
    <span className={className} data-ctx={empty ? "unknown" : context} role="img" aria-label={label}>
      {content}
    </span>
  );
}

/** Five bars plus "Confidence 80%" and " · still learning" under 50%. */
export function Confidence({ value }: { value: number }) {
  const n = Math.round(value * 5);
  return (
    <span className={styles.confidence}>
      <span className={styles.confBars} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} className={i < n ? styles.on : undefined} />
        ))}
      </span>
      <span>
        Confidence <b className={styles.confValue}>{Math.round(value * 100)}%</b>
        {value < 0.5 ? " · still learning" : ""}
      </span>
    </span>
  );
}
