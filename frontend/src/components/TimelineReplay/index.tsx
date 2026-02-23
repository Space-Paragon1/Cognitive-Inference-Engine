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
import { getTimeline, getSessions } from "../../api/client";
import type { SessionSummary, TimelineEntry } from "../../types";

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
  { label: "1 h",  seconds: 3600 },
  { label: "6 h",  seconds: 6 * 3600 },
  { label: "24 h", seconds: 24 * 3600 },
  { label: "7 d",  seconds: 7 * 24 * 3600 },
];

// Playback interval base (ms per step at 1× speed)
const BASE_INTERVAL_MS = 600;

const SPEEDS = [0.5, 1, 2, 4, 8];

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + fmtTime(ts);
}

function fmtMin(min: number): string {
  if (min < 60) return `${Math.round(min)}m`;
  return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
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

function loadColor(score: number) {
  return score > 0.7 ? "#f05a4a" : score > 0.45 ? "#f0c040" : "#4af0a0";
}

function exportCSV(entries: TimelineEntry[]): void {
  const header = "timestamp,iso_time,source,event_type,load_score,context,metadata\n";
  const rows = entries.map((e) => {
    const iso = new Date(e.timestamp * 1000).toISOString();
    const meta = e.metadata_json.replace(/"/g, '""');
    return `${e.timestamp},${iso},${e.source},${e.event_type},${e.load_score.toFixed(4)},${e.context},"${meta}"`;
  }).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timeline_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Parse metadata_json and render key-value pairs neatly. */
function parseMetadata(json: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch { /* ignore */ }
  return null;
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
          <div key={ctx}
            title={`${ctx.replace(/_/g, " ")}: ${Math.round((count / total) * 100)}%`}
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

function SessionPill({
  session, active, onClick,
}: { session: SessionSummary; active: boolean; onClick: () => void }) {
  const color = CTX_COLOR[session.dominant_context] ?? "#666";
  return (
    <button
      onClick={onClick}
      title={`${fmtTime(session.start_ts)} → ${fmtTime(session.end_ts)} · ${fmtMin(session.duration_minutes)}`}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "3px 9px", borderRadius: 8, border: "none", cursor: "pointer",
        background: active ? color + "22" : "#1a1a2e",
        outline: active ? `1px solid ${color}55` : "1px solid #1e1e3a",
        fontSize: 11, fontWeight: 600, color: active ? color : "#888",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
      {fmtTime(session.start_ts).slice(0, 5)}
      <span style={{ opacity: 0.5, fontWeight: 400 }}>{fmtMin(session.duration_minutes)}</span>
    </button>
  );
}

/** Icon button used in the playback control strip. */
function IconBtn({
  label, title, onClick, active, accent,
}: { label: string; title: string; onClick: () => void; active?: boolean; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        fontSize: 14, lineHeight: 1, padding: "5px 9px",
        borderRadius: 7, border: "none", cursor: "pointer",
        background: active ? "#4a4af033" : accent ? "#f0c04022" : "#1a1a2e",
        color: active ? "#4a4af0" : accent ? "#f0c040" : "#aaa",
        outline: active ? "1px solid #4a4af044" : "1px solid #1e1e3a",
        transition: "background 0.15s",
        userSelect: "none",
      }}
    >
      {label}
    </button>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function TimelineReplay() {
  const [windowIdx, setWindowIdx] = useState(0);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const fetchRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Playback interval ───────────────────────────────────────────────────

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!playing) return;

    intervalRef.current = setInterval(() => {
      setPlayhead((prev) => {
        if (prev >= entries.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, BASE_INTERVAL_MS / playbackSpeed);

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [playing, playbackSpeed, entries.length]);

  // Stop playback when entries change (window/session switch)
  useEffect(() => { setPlaying(false); }, [entries]);

  // ── Data fetching ───────────────────────────────────────────────────────

  useEffect(() => {
    const windowS = WINDOWS[windowIdx].seconds;
    const since = Date.now() / 1000 - windowS;
    getSessions({ since }).then((s) => {
      setSessions(s);
      setActiveSession(null);
    }).catch(() => {});
  }, [windowIdx]);

  useEffect(() => {
    const id = ++fetchRef.current;
    setLoading(true);

    let since: number;
    let until: number | undefined;

    if (activeSession) {
      since = activeSession.start_ts - 60;
      until = activeSession.end_ts + 60;
    } else {
      const windowS = WINDOWS[windowIdx].seconds;
      since = Date.now() / 1000 - windowS;
      until = undefined;
    }

    getTimeline({ since, until, limit: 1000, source: "engine" })
      .then((data) => {
        if (fetchRef.current !== id) return;
        setEntries(data);
        setPlayhead(Math.max(0, data.length - 1));
      })
      .catch(() => {})
      .finally(() => { if (fetchRef.current === id) setLoading(false); });
  }, [windowIdx, activeSession]);

  // ── Derived values ──────────────────────────────────────────────────────

  const stats = computeStats(entries);
  const chartData = entries.map((e, i) => ({
    i, ts: e.timestamp,
    load: Math.round(e.load_score * 100),
    context: e.context,
  }));

  const currentEntry = entries[playhead] ?? null;
  const playheadTs = currentEntry ? chartData[playhead]?.ts : null;

  // ── Callbacks ───────────────────────────────────────────────────────────

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaying(false);
    setPlayhead(Number(e.target.value));
  }, []);

  const handleSessionClick = (s: SessionSummary) => {
    setActiveSession((prev) => prev?.session_index === s.session_index ? null : s);
  };

  const handlePlayPause = () => {
    if (playing) {
      setPlaying(false);
    } else {
      // If at end, restart from beginning
      if (playhead >= entries.length - 1) setPlayhead(0);
      setPlaying(true);
    }
  };

  const handleStop = () => {
    setPlaying(false);
    setPlayhead(0);
  };

  const handleStepBack = () => { setPlaying(false); setPlayhead((p) => Math.max(0, p - 1)); };
  const handleStepForward = () => { setPlaying(false); setPlayhead((p) => Math.min(entries.length - 1, p + 1)); };
  const handleJumpStart = () => { setPlaying(false); setPlayhead(0); };
  const handleJumpEnd = () => { setPlaying(false); setPlayhead(Math.max(0, entries.length - 1)); };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{
          fontSize: 13, fontWeight: 600, opacity: 0.5,
          textTransform: "uppercase", letterSpacing: "0.08em", margin: 0,
        }}>
          Timeline Replay
        </h3>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {entries.length > 0 && (
            <button
              onClick={() => exportCSV(entries)}
              title="Export current view as CSV"
              style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px",
                borderRadius: 8, border: "none", cursor: "pointer",
                background: "#1e3a1e", color: "#4af0a0",
                outline: "1px solid #4af0a022",
              }}
            >
              ↓ CSV
            </button>
          )}
          {WINDOWS.map((w, i) => (
            <button key={w.label} onClick={() => { setWindowIdx(i); setActiveSession(null); }}
              style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px",
                borderRadius: 8, border: "none", cursor: "pointer",
                background: i === windowIdx && !activeSession ? "#4a4af0" : "#1e1e3a",
                color: i === windowIdx && !activeSession ? "#fff" : "#aaa",
              }}>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Session pills */}
      {sessions.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Sessions — click to zoom
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {sessions.map((s) => (
              <SessionPill
                key={s.session_index}
                session={s}
                active={activeSession?.session_index === s.session_index}
                onClick={() => handleSessionClick(s)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Stats row */}
      {stats && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <StatChip label="Avg Load" value={`${Math.round(stats.avg * 100)}%`}
            color={loadColor(stats.avg)} />
          <StatChip label="Peak Load" value={`${Math.round(stats.peak * 100)}%`}
            color={loadColor(stats.peak)} />
          <StatChip label="Events" value={String(stats.total)} />
          {activeSession && (
            <StatChip label="Duration" value={fmtMin(activeSession.duration_minutes)} color="#4ab0f0" />
          )}
        </div>
      )}

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
            <XAxis dataKey="i" hide />
            <YAxis domain={[0, 100]} tick={{ fill: "#666", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a4a", fontSize: 12 }}
              formatter={(v: number) => [`${v}%`, "Load"]}
              labelFormatter={(i: number) => chartData[i] ? fmtTime(chartData[i].ts) : ""}
            />
            {playheadTs !== null && (
              <ReferenceLine x={playhead} stroke="#f0c040" strokeWidth={1.5} strokeDasharray="4 2" />
            )}
            <Area type="monotone" dataKey="load"
              stroke="#4a4af0" fill="url(#replayGrad)" strokeWidth={2} dot={false} />
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
          <input type="range" min={0} max={entries.length - 1} value={playhead}
            onChange={handleScrub}
            style={{ width: "100%", accentColor: "#f0c040", cursor: "pointer" }} />
        </div>
      )}

      {/* ── Playback controls ─────────────────────────────────────────────── */}
      {entries.length > 1 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          marginTop: 10, flexWrap: "wrap",
        }}>
          {/* Transport */}
          <div style={{ display: "flex", gap: 4 }}>
            <IconBtn label="⏮" title="Jump to start" onClick={handleJumpStart} />
            <IconBtn label="◀" title="Step back one event" onClick={handleStepBack} />
            <IconBtn
              label={playing ? "⏸" : "▶"}
              title={playing ? "Pause" : playhead >= entries.length - 1 ? "Replay from start" : "Play"}
              onClick={handlePlayPause}
              accent={!playing}
              active={playing}
            />
            <IconBtn label="▶" title="Step forward one event" onClick={handleStepForward} />
            <IconBtn label="⏭" title="Jump to end" onClick={handleJumpEnd} />
            <IconBtn label="■" title="Stop and reset to start" onClick={handleStop} />
          </div>

          {/* Playhead counter */}
          <span style={{ fontSize: 11, opacity: 0.4, fontFamily: "monospace", minWidth: 70 }}>
            {playhead + 1} / {entries.length}
          </span>

          {/* Speed selector */}
          <div style={{ display: "flex", gap: 3, marginLeft: "auto" }}>
            <span style={{ fontSize: 10, opacity: 0.4, alignSelf: "center", marginRight: 2 }}>Speed</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setPlaybackSpeed(s)}
                style={{
                  fontSize: 10, fontWeight: 600, padding: "3px 7px",
                  borderRadius: 6, border: "none", cursor: "pointer",
                  background: playbackSpeed === s ? "#4a4af0" : "#1a1a2e",
                  color: playbackSpeed === s ? "#fff" : "#666",
                  outline: "1px solid #1e1e3a",
                }}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Playhead info box */}
      {currentEntry && (
        <div style={{
          marginTop: 12, background: "#1a1a2e",
          border: `1px solid ${CTX_COLOR[currentEntry.context] ?? "#2a2a4a"}44`,
          borderRadius: 10, padding: "10px 14px",
          display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 10, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Time</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 1 }}>{fmtDate(currentEntry.timestamp)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Load</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: loadColor(currentEntry.load_score) }}>
              {Math.round(currentEntry.load_score * 100)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Context</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: CTX_COLOR[currentEntry.context] ?? "#aaa", marginTop: 1 }}>
              {currentEntry.context.replace(/_/g, " ")}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 10, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              Details
            </div>
            <MetadataView json={currentEntry.metadata_json} />
          </div>
        </div>
      )}

      {/* Context distribution */}
      {stats && Object.keys(stats.ctxDist).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, opacity: 0.4, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Context distribution
          </div>
          <ContextBar ctxDist={stats.ctxDist} total={stats.total} />
        </div>
      )}

      {/* Event log */}
      {entries.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, opacity: 0.4, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Event log (most recent first)
          </div>
          <div style={{ maxHeight: 180, overflowY: "auto", borderRadius: 8, border: "1px solid #1e1e3a", fontSize: 11 }}>
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
                    <tr key={e.id ?? idx} onClick={() => { setPlaying(false); setPlayhead(origIdx); }}
                      style={{
                        cursor: "pointer",
                        background: origIdx === playhead ? "#1e1e3a" : "transparent",
                        borderBottom: "1px solid #12122a",
                      }}>
                      <td style={{ padding: "4px 10px", opacity: 0.6, fontFamily: "monospace" }}>{fmtTime(e.timestamp)}</td>
                      <td style={{ padding: "4px 10px", fontWeight: 600, color: loadColor(e.load_score) }}>
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

// ── Metadata viewer ──────────────────────────────────────────────────────────

function MetadataView({ json }: { json: string }) {
  const parsed = parseMetadata(json);

  if (!parsed) {
    // Raw fallback for non-object JSON or plain strings
    return (
      <div style={{ fontSize: 11, opacity: 0.55, fontFamily: "monospace", wordBreak: "break-all" }}>
        {json || "—"}
      </div>
    );
  }

  const entries = Object.entries(parsed).filter(([, v]) => v !== null && v !== undefined);
  if (!entries.length) return <div style={{ fontSize: 11, opacity: 0.3 }}>—</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {entries.map(([k, v]) => {
        const valStr = typeof v === "object" ? JSON.stringify(v) : String(v);
        return (
          <div key={k} style={{ display: "flex", gap: 8, fontSize: 11 }}>
            <span style={{ opacity: 0.4, fontFamily: "monospace", minWidth: 120, flexShrink: 0 }}>
              {k.replace(/_/g, " ")}
            </span>
            <span style={{ opacity: 0.8, fontFamily: "monospace", wordBreak: "break-all" }}>
              {valStr}
            </span>
          </div>
        );
      })}
    </div>
  );
}
