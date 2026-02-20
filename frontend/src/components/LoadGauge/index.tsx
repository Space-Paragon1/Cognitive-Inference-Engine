import type { CognitiveState } from "../../types";

const CONTEXT_LABELS: Record<string, string> = {
  deep_focus: "🎯 Deep Focus",
  shallow_work: "🌊 Shallow Work",
  stuck: "🔁 Stuck Loop",
  fatigue: "😓 Fatigue",
  recovering: "🔋 Recovering",
  unknown: "❓ Unknown",
};

const CONTEXT_COLORS: Record<string, string> = {
  deep_focus: "#4af0a0",
  shallow_work: "#f0d04a",
  stuck: "#f09a4a",
  fatigue: "#f05a4a",
  recovering: "#4ac0f0",
  unknown: "#7a7aaa",
};

interface Props {
  state: CognitiveState;
}

export function LoadGauge({ state }: Props) {
  const pct = Math.round(state.load_score * 100);
  const color = CONTEXT_COLORS[state.context] ?? "#7a7aaa";
  const circumference = 2 * Math.PI * 44;
  const dashOffset = circumference * (1 - state.load_score);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {/* Circular gauge */}
      <div style={{ position: "relative", width: 120, height: 120 }}>
        <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="60" cy="60" r="44" fill="none" stroke="#1e1e3a" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="44" fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 26, fontWeight: 700, color }}>{pct}%</span>
          <span style={{ fontSize: 10, opacity: 0.5 }}>load</span>
        </div>
      </div>

      {/* Context label */}
      <div style={{ fontSize: 14, fontWeight: 600, color }}>
        {CONTEXT_LABELS[state.context]}
      </div>

      {/* Confidence */}
      <div style={{ fontSize: 11, opacity: 0.4 }}>
        Confidence: {Math.round(state.confidence * 100)}%
      </div>

      {/* Breakdown bars */}
      <div style={{ width: "100%", maxWidth: 200, display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          { label: "Intrinsic", value: state.breakdown.intrinsic, color: "#f0a04a" },
          { label: "Extraneous", value: state.breakdown.extraneous, color: "#f05a4a" },
          { label: "Germane", value: state.breakdown.germane, color: "#4af0a0" },
        ].map(({ label, value, color: c }) => (
          <div key={label}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.5, marginBottom: 2 }}>
              <span>{label}</span>
              <span>{Math.round(value * 100)}%</span>
            </div>
            <div style={{ background: "#1e1e3a", borderRadius: 4, height: 5, overflow: "hidden" }}>
              <div style={{
                width: `${value * 100}%`, height: "100%",
                background: c, borderRadius: 4,
                transition: "width 0.4s ease",
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
