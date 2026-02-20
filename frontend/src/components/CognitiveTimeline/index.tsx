import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimelineEntry } from "../../types";

interface Props {
  scores: number[];
  entries: TimelineEntry[];
}

export function CognitiveTimeline({ scores, entries }: Props) {
  const data = scores.map((score, i) => ({
    t: i,
    load: Math.round(score * 100),
  }));

  const contextCounts: Record<string, number> = {};
  for (const e of entries) {
    contextCounts[e.context] = (contextCounts[e.context] ?? 0) + 1;
  }

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
        Load History (5 min window)
      </h3>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4a4af0" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#4a4af0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
            <XAxis dataKey="t" hide />
            <YAxis domain={[0, 100]} tick={{ fill: "#666", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a4a", fontSize: 12 }}
              formatter={(v: number) => [`${v}%`, "Load"]}
              labelFormatter={() => ""}
            />
            <Area
              type="monotone" dataKey="load"
              stroke="#4a4af0" fill="url(#loadGrad)"
              strokeWidth={2} dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.3, fontSize: 13 }}>
          Waiting for data…
        </div>
      )}

      {/* Context distribution */}
      {Object.keys(contextCounts).length > 0 && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(contextCounts).map(([ctx, count]) => (
            <span key={ctx} style={{
              fontSize: 11, padding: "2px 8px",
              background: "#1e1e3a", borderRadius: 12, opacity: 0.7,
            }}>
              {ctx.replace("_", " ")} × {count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
