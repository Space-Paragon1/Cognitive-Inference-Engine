import { useEffect, useState } from "react";
import { getDailyStats, getSessions } from "../../api/client";
import type { DailyStats, SessionSummary } from "../../types";

const CTX_COLOR: Record<string, string> = {
  deep_focus: "#4af0a0",
  shallow_work: "#f0c040",
  stuck: "#f05a4a",
  fatigue: "#b066cc",
  recovering: "#4ab0f0",
  unknown: "#555",
};

function fmtMin(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Sub-components ──────────────────────────────────────────────────────────

function MiniStat({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? "#fff", lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, opacity: 0.45, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function SessionRow({ session }: { session: SessionSummary }) {
  const color = CTX_COLOR[session.dominant_context] ?? "#aaa";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "5px 0", borderBottom: "1px solid #12122a",
      fontSize: 11,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%",
        background: color, flexShrink: 0,
      }} />
      <div style={{ flex: 1, opacity: 0.7 }}>
        {fmtTime(session.start_ts)} → {fmtTime(session.end_ts)}
      </div>
      <div style={{ color, fontWeight: 600 }}>
        {fmtMin(session.duration_minutes)}
      </div>
      <div style={{ opacity: 0.5, minWidth: 32, textAlign: "right" }}>
        {Math.round(session.avg_load_score * 100)}%
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function StatsCard() {
  const [today, setToday] = useState<DailyStats | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    // Fetch today's stats: since midnight UTC
    const midnightUtc = new Date();
    midnightUtc.setUTCHours(0, 0, 0, 0);
    const since = midnightUtc.getTime() / 1000;

    getDailyStats({ since }).then((data) => {
      if (data.length > 0) setToday(data[data.length - 1]);
    }).catch(() => {});

    getSessions({ since }).then(setSessions).catch(() => {});

    // Refresh every 30 s
    const id = setInterval(() => {
      getDailyStats({ since }).then((data) => {
        if (data.length > 0) setToday(data[data.length - 1]);
      }).catch(() => {});
      getSessions({ since }).then(setSessions).catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <h3 style={{
        fontSize: 13, fontWeight: 600, opacity: 0.5,
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14,
      }}>
        Today's Stats
      </h3>

      {today ? (
        <>
          <MiniStat
            label="Focus time"
            value={fmtMin(today.focus_minutes)}
            sub={`of ${fmtMin(today.total_session_minutes)} total`}
            color="#4af0a0"
          />
          <MiniStat
            label="Sessions"
            value={String(today.session_count)}
            sub={`${today.tick_count} inference ticks`}
          />
          <MiniStat
            label="Avg load"
            value={`${Math.round(today.avg_load_score * 100)}%`}
            sub={`peak ${Math.round(today.peak_load_score * 100)}%`}
            color={today.avg_load_score > 0.7 ? "#f05a4a" : today.avg_load_score > 0.45 ? "#f0c040" : "#4af0a0"}
          />

          {/* Context distribution mini-bar */}
          {Object.keys(today.context_distribution).length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                Context split
              </div>
              <div style={{ height: 8, borderRadius: 4, overflow: "hidden", display: "flex" }}>
                {Object.entries(today.context_distribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([ctx, frac]) => (
                    <div
                      key={ctx}
                      title={`${ctx.replace("_", " ")}: ${Math.round(frac * 100)}%`}
                      style={{
                        width: `${frac * 100}%`,
                        background: CTX_COLOR[ctx] ?? "#444",
                      }}
                    />
                  ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ opacity: 0.3, fontSize: 12, marginBottom: 14 }}>No data yet today</div>
      )}

      {/* Session list */}
      {sessions.length > 0 && (
        <div>
          <div style={{ fontSize: 10, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Sessions today
          </div>
          <div style={{ maxHeight: 160, overflowY: "auto" }}>
            {[...sessions].reverse().map((s) => (
              <SessionRow key={s.session_index} session={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
