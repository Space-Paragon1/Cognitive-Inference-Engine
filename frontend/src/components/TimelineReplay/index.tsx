import { useCallback, useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getTimeline } from "../../api/client";
import type { TimelineEntry } from "../../types";

// ── Context colour map ──────────────────────────────────────────────────────

const CTX_COLOR: Record<string, string> = {
  deep_focus: "#4af0a0",
  shallow_work: "#f0c040",
  stuck: "#f05a4a",
  fatigue: "#b066cc",
  recovering: "#4ab0f0",
  unknown: "#666",
};

// ── Time window presets ─────────────────────────────────────────────────────

const WINDOWS = [
  { label: "1 h", seconds: 3600 },
  { label: "6 h", seconds: 6 * 3600 },
  { label: "24 h", seconds: 24 * 3600 },
  { label: "7 d", seconds: 7 * 24 * 3600 },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + fmtTime(ts);
}

function computeStats(entries: TimelineEntry[]) {
  if (!entries.length) return null;
  const scores = entries.map((e) => e.load_score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const peak = Math.max(...scores);
  const ctxDist: Record<string, number> = {};
  for (const e of entries) {
    ctxDist[e.context] = (ctxDist[e.context] ?? 0) + 1;
  }
  return { avg, peak, ctxDist, total: entries.length };
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: "#1a1a2e", borderRadius: 10, padding: "8px 14px",
      border: "1px solid #1e1e3a", flex: "1 1 0", minWidth: 80,
    }}>
      <div style={{ fontSize: 10, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: color ?? "#fff" }}>{value}</div>
    </div>
  );
}

function ContextBar({ ctxDist, total }: { ctxDist: Record<string, number>; total: number }) {
  const sorted = Object.entries(ctxDist).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <div style={{ height: 10, borderRadius: 5, overflow: "hidden", display: "flex", marginBottom: 6 }}>
        {sorted.map(([ctx, count]) => (
          <div
            key={ctx}
            title={`${ctx.replace("_", " ")}: ${Math.round((count / total) * 100)}%`}
            style={{ width: `${(count / total) * 100}%`, background: CTX_COLOR[ctx] ?? "#444" }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {sorted.map(([ctx, count]) => (
          <span key={ctx} style={{ fontSize: 11, color: CTX_COLOR[ctx] ?? "#aaa" }}>
            ■ {ctx.replace(/_/g, " ")} {Math.round((count / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function TimelineReplay() {
  const [windowIdx, setWindowIdx] = useState(0); // index into WINDOWS
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [playhead, setPlayhead] = useState(0); // index into entries
  const fetchRef = useRef(0);

  // Fetch entries when window changes
  useEffect(() => {
    const id = ++fetchRef.current;
    setLoading(true);
    const windowS = WINDOWS[windowIdx].seconds;
    const since = Date.now() / 1000 - windowS;
    getTimeline({ since, limit: 1000, source: "engine" })
      .then((data) => {
        if (fetchRef.current !== id) return;
        setEntries(data);
        setPlayhead(Math.max(0, data.length - 1));
      })
      .catch(() => {})
      .finally(() => { if (fetchRef.current === id) setLoading(false); });
  }, [windowIdx]);

  const stats = computeStats(entries);
  const chartData = entries.map((e, i) => ({
    i,
    ts: e.timestamp,
    load: Math.round(e.load_score * 100),
    context: e.context,
  }));

  const currentEntry = entries[playhead] ?? null;

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayhead(Number(e.target.value));
  }, []);

  const playheadTs = currentEntry ? chartData[playhead]?.ts : null;

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
          Timeline Replay
        </h3>
        <div style={{ display: "flex", gap: 6 }}>
          {WINDOWS.map((w, i) => (
            <button
              key={w.label}
              onClick={() => setWindowIdx(i)}
              style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px",
                borderRadius: 8, border: "none", cursor: "pointer",
                background: i === windowIdx ? "#4a4af0" : "#1e1e3a",
                color: i === windowIdx ? "#fff" : "#aaa",
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      {stats ? (
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <StatChip label="Avg Load" value={`${Math.round(stats.avg * 100)}%`}
            color={stats.avg > 0.7 ? "#f05a4a" : stats.avg > 0.45 ? "#f0c040" : "#4af0a0"} />
          <StatChip label="Peak Load" value={`${Math.round(stats.peak * 100)}%`}
            color={stats.peak > 0.7 ? "#f05a4a" : "#f0c040"} />
          <StatChip label="Events" value={String(stats.total)} />
        </div>
      ) : null}

      {/* Area chart */}
      {loading ? (
        <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.3, fontSize: 13 }}>
          Loading…
        </div>
      ) : chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="replayGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4a4af0" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#4a4af0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
            <XAxis
              dataKey="i" hide
              tickFormatter={(i: number) => chartData[i] ? fmtTime(chartData[i].ts) : ""}
            />
            <YAxis domain={[0, 100]} tick={{ fill: "#666", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a4a", fontSize: 12 }}
              formatter={(v: number) => [`${v}%`, "Load"]}
              labelFormatter={(i: number) => chartData[i] ? fmtTime(chartData[i].ts) : ""}
            />
            {playheadTs !== null && (
              <ReferenceLine
                x={playhead}
                stroke="#f0c040"
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
            )}
            <Area
              type="monotone" dataKey="load"
              stroke="#4a4af0" fill="url(#replayGrad)"
              strokeWidth={2} dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.3, fontSize: 13 }}>
          No data for this window
        </div>
      )}

      {/* Scrubber */}
      {entries.length > 1 && (
        <div style={{ marginTop: 8 }}>
          <input
            type="range"
            min={0}
            max={entries.length - 1}
            value={playhead}
            onChange={handleScrub}
            style={{ width: "100%", accentColor: "#f0c040", cursor: "pointer" }}
          />
        </div>
      )}

      {/* Playhead info box */}
      {currentEntry && (
        <div style={{
          marginTop: 12,
          background: "#1a1a2e",
          border: `1px solid ${CTX_COLOR[currentEntry.context] ?? "#2a2a4a"}44`,
          borderRadius: 10, padding: "10px 14px",
          display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 10, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Time</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 1 }}>{fmtDate(currentEntry.timestamp)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Load</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: currentEntry.load_score > 0.7 ? "#f05a4a" : "#4af0a0" }}>
              {Math.round(currentEntry.load_score * 100)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Context</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: CTX_COLOR[currentEntry.context] ?? "#aaa", marginTop: 1 }}>
              {currentEntry.context.replace(/_/g, " ")}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 10, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Details</div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 1, fontFamily: "monospace" }}>
              {currentEntry.metadata_json}
            </div>
          </div>
        </div>
      )}

      {/* Context distribution bar */}
      {stats && Object.keys(stats.ctxDist).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, opacity: 0.4, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Context distribution
          </div>
          <ContextBar ctxDist={stats.ctxDist} total={stats.total} />
        </div>
      )}

      {/* Recent event log */}
      {entries.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, opacity: 0.4, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Event log (most recent first)
          </div>
          <div style={{
            maxHeight: 180, overflowY: "auto", borderRadius: 8,
            border: "1px solid #1e1e3a", fontSize: 11,
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1a1a2e", position: "sticky", top: 0 }}>
                  {["Time", "Load", "Context"].map((h) => (
                    <th key={h} style={{ padding: "5px 10px", textAlign: "left", opacity: 0.4, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...entries].reverse().slice(0, 100).map((e, idx) => {
                  const origIdx = entries.length - 1 - idx;
                  return (
                    <tr
                      key={e.id ?? idx}
                      onClick={() => setPlayhead(origIdx)}
                      style={{
                        cursor: "pointer",
                        background: origIdx === playhead ? "#1e1e3a" : "transparent",
                        borderBottom: "1px solid #12122a",
                      }}
                    >
                      <td style={{ padding: "4px 10px", opacity: 0.6, fontFamily: "monospace" }}>{fmtTime(e.timestamp)}</td>
                      <td style={{
                        padding: "4px 10px", fontWeight: 600,
                        color: e.load_score > 0.7 ? "#f05a4a" : e.load_score > 0.45 ? "#f0c040" : "#4af0a0",
                      }}>
                        {Math.round(e.load_score * 100)}%
                      </td>
                      <td style={{ padding: "4px 10px", color: CTX_COLOR[e.context] ?? "#aaa" }}>
                        {e.context.replace(/_/g, " ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
