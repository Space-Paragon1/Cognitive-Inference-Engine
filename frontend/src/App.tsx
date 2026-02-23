import { CognitiveTimeline } from "./components/CognitiveTimeline";
import { ControlPanel } from "./components/ControlPanel";
import { LoadGauge } from "./components/LoadGauge";
import { TaskQueue } from "./components/TaskQueue";
import { TimelineReplay } from "./components/TimelineReplay";
import { useCognitiveState } from "./hooks/useCognitiveState";
import { useTimeline } from "./hooks/useTimeline";

const styles = {
  root: {
    minHeight: "100vh",
    padding: "24px 32px",
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    gridTemplateRows: "auto 1fr",
    gap: 24,
    maxWidth: 1200,
    margin: "0 auto",
  } as React.CSSProperties,
  header: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as React.CSSProperties,
  title: { fontSize: 20, fontWeight: 700 } as React.CSSProperties,
  badge: {
    fontSize: 11, padding: "3px 10px", borderRadius: 12,
    fontWeight: 600,
  } as React.CSSProperties,
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  } as React.CSSProperties,
  main: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  } as React.CSSProperties,
  card: {
    background: "#13132b",
    borderRadius: 16,
    padding: 20,
    border: "1px solid #1e1e3a",
  } as React.CSSProperties,
} as const;

export default function App() {
  const { state, connected } = useCognitiveState();
  const { entries, scores } = useTimeline(300);

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <div style={styles.title}>🧠 Cognitive Load Router</div>
          <div style={{ fontSize: 12, opacity: 0.4, marginTop: 2 }}>
            Local-first student productivity intelligence
          </div>
        </div>
        <span style={{
          ...styles.badge,
          background: connected ? "#4af0a033" : "#f05a4a33",
          color: connected ? "#4af0a0" : "#f05a4a",
        }}>
          {connected ? "● Engine Connected" : "○ Engine Offline"}
        </span>
      </header>

      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.card}>
          <LoadGauge state={state} />
        </div>
      </aside>

      {/* Main content */}
      <main style={styles.main}>
        <div style={styles.card}>
          <ControlPanel />
        </div>
        <div style={styles.card}>
          <CognitiveTimeline scores={scores} entries={entries} />
        </div>
        <div style={styles.card}>
          <TimelineReplay />
        </div>
        <div style={styles.card}>
          <TaskQueue />
        </div>
      </main>
    </div>
  );
}
