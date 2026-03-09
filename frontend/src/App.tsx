import { useEffect, useRef, useState } from "react";
import { useAuth } from "./auth/AuthContext";
import { AnalyticsPanel } from "./components/Analytics";
import { CognitiveTimeline } from "./components/CognitiveTimeline";
import { ControlPanel } from "./components/ControlPanel";
import { DirectivesFeed } from "./components/DirectivesFeed";
import { LoadGauge } from "./components/LoadGauge";
import { LoginPage } from "./components/LoginPage";
import { SettingsPanel } from "./components/Settings";
import { StatsCard } from "./components/StatsCard";
import { TaskQueue } from "./components/TaskQueue";
import { TimelineReplay } from "./components/TimelineReplay";
import { useCognitiveState } from "./hooks/useCognitiveState";
import { useNotifications } from "./hooks/useNotifications";
import { useTimeline } from "./hooks/useTimeline";

// ── Context transition messages ──────────────────────────────────────────────

const CTX_MESSAGES: Record<string, [string, string]> = {
  stuck:        ["You seem stuck", "Try breaking the problem into smaller steps."],
  fatigue:      ["Signs of fatigue detected", "A short break might help you recover."],
  recovering:   ["You're recovering", "Cognitive load is dropping — nice work."],
  deep_focus:   ["Deep focus activated", "You're in the zone. Keep it up!"],
  shallow_work: ["Shifting to shallow work", "Good time for emails or lighter tasks."],
};

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  root: {
    minHeight: "100vh",
    padding: "24px clamp(12px, 4vw, 32px)",
    display: "grid",
    gridTemplateColumns: "clamp(200px, 22vw, 260px) 1fr",
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
    flexWrap: "wrap",
    gap: 10,
  } as React.CSSProperties,
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  } as React.CSSProperties,
  title: { fontSize: 20, fontWeight: 700 } as React.CSSProperties,
  subtitle: { fontSize: 12, opacity: 0.4, marginTop: 2 } as React.CSSProperties,
  iconBtnBase: {
    fontSize: 16,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "4px 6px",
    borderRadius: 8,
    transition: "opacity 0.2s",
  } as React.CSSProperties,
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
  logoutBtn: {
    fontSize: 11,
    background: "none",
    border: "1px solid #2a2a4a",
    cursor: "pointer",
    padding: "4px 10px",
    borderRadius: 8,
    color: "#6666aa",
    fontWeight: 600,
  } as React.CSSProperties,
} as const;

// ── Responsive override injected once ────────────────────────────────────────

const MOBILE_CSS = `
@media (max-width: 640px) {
  .clr-root {
    grid-template-columns: 1fr !important;
  }
}
`;

function injectMobileCss() {
  if (document.getElementById("clr-mobile-css")) return;
  const style = document.createElement("style");
  style.id = "clr-mobile-css";
  style.textContent = MOBILE_CSS;
  document.head.appendChild(style);
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { user, loading, logout } = useAuth();

  injectMobileCss();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#6666aa" }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Dashboard user={user} logout={logout} />;
}

function Dashboard({ user, logout }: { user: { email: string }; logout: () => void }) {
  const { state, connected } = useCognitiveState();
  const { entries, scores } = useTimeline(300);
  const { enabled, supported, permission, request, disable, notify } = useNotifications();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const prevContextRef = useRef<string>("unknown");
  const highLoadCountRef = useRef(0);

  useEffect(() => {
    const prev = prevContextRef.current;
    const curr = state.context;
    prevContextRef.current = curr;
    if (prev === curr || curr === "unknown" || prev === "unknown") return;
    const msg = CTX_MESSAGES[curr];
    if (msg) notify(curr, msg[0], msg[1]);
  }, [state.context, notify]);

  useEffect(() => {
    if (state.load_score > 0.85) {
      highLoadCountRef.current += 1;
      if (highLoadCountRef.current === 3) {
        notify(
          "load_spike",
          "Cognitive overload warning",
          `Load is at ${Math.round(state.load_score * 100)}% — consider stepping back.`
        );
      }
    } else {
      highLoadCountRef.current = 0;
    }
  }, [state.load_score, notify]);

  const handleBellClick = async () => {
    if (enabled) {
      disable();
    } else {
      if (permission === "denied") return;
      await request();
    }
  };

  const bellStyle: React.CSSProperties = {
    ...styles.iconBtnBase,
    opacity: permission === "denied" ? 0.3 : enabled ? 1 : 0.45,
    outline: enabled ? "1px solid #4a4af044" : "none",
    color: enabled ? "#4a4af0" : "#aaa",
  };
  const gearStyle: React.CSSProperties = {
    ...styles.iconBtnBase,
    opacity: settingsOpen ? 1 : 0.5,
    color: settingsOpen ? "#4a4af0" : "#aaa",
    outline: settingsOpen ? "1px solid #4a4af044" : "none",
  };
  const analyticsStyle: React.CSSProperties = {
    ...styles.iconBtnBase,
    opacity: analyticsOpen ? 1 : 0.5,
    color: analyticsOpen ? "#4a4af0" : "#aaa",
    outline: analyticsOpen ? "1px solid #4a4af044" : "none",
  };
  const badgeStyle: React.CSSProperties = {
    ...styles.badge,
    background: connected ? "#4af0a033" : "#f05a4a33",
    color: connected ? "#4af0a0" : "#f05a4a",
  };

  const bellTitle = permission === "denied"
    ? "Notifications blocked by browser"
    : enabled ? "Notifications on — click to disable" : "Enable notifications";

  return (
    <div style={styles.root} className="clr-root">
      {/* Header */}
      <header style={styles.header}>
        <div>
          <div style={styles.title}>Cognitive Load Router</div>
          <div style={styles.subtitle}>
            Local-first student productivity intelligence
          </div>
        </div>

        <div style={styles.headerRight}>
          {supported && (
            <button type="button" onClick={handleBellClick} title={bellTitle} style={bellStyle}>
              {enabled ? "\uD83D\uDD14" : "\uD83D\uDD15"}
            </button>
          )}
          <button
            type="button"
            title="Weekly analytics"
            style={analyticsStyle}
            onClick={() => { setSettingsOpen(false); setAnalyticsOpen((o) => !o); }}
          >
            ▦
          </button>
          <button
            type="button"
            title="Settings"
            style={gearStyle}
            onClick={() => { setAnalyticsOpen(false); setSettingsOpen((o) => !o); }}
          >
            ⚙
          </button>
          <span style={badgeStyle}>
            {connected ? "● Engine Connected" : "○ Engine Offline"}
          </span>
          <span style={{ fontSize: 11, color: "#4444aa" }}>{user.email}</span>
          <button type="button" style={styles.logoutBtn} onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.card}>
          <LoadGauge state={state} />
        </div>
        <div style={styles.card}>
          <StatsCard />
        </div>
      </aside>

      {/* Main content */}
      <main style={styles.main}>
        <div style={styles.card}>
          <ControlPanel notify={notify} />
        </div>
        <div style={styles.card}>
          <DirectivesFeed />
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

      {/* Drawers */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {analyticsOpen && <AnalyticsPanel onClose={() => setAnalyticsOpen(false)} />}
    </div>
  );
}
