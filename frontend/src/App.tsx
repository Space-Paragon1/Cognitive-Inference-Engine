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

// ── Tab definition ───────────────────────────────────────────────────────────

type Tab = "home" | "control" | "timeline" | "tasks" | "more";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "home",     icon: "◉",  label: "Home" },
  { id: "control",  icon: "⏱",  label: "Timer" },
  { id: "timeline", icon: "📈", label: "History" },
  { id: "tasks",    icon: "✓",  label: "Tasks" },
  { id: "more",     icon: "⋯",  label: "More" },
];

// ── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: {
    minHeight: "100vh",
    padding: "16px clamp(8px, 4vw, 32px) 16px",
    display: "grid",
    gridTemplateColumns: "clamp(200px, 22vw, 260px) 1fr",
    gridTemplateRows: "auto 1fr",
    gap: 20,
    maxWidth: 1200,
    margin: "0 auto",
  } as React.CSSProperties,
  header: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap" as const,
    gap: 8,
  } as React.CSSProperties,
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,
  title: { fontSize: "clamp(16px, 4vw, 20px)", fontWeight: 700 } as React.CSSProperties,
  subtitle: { fontSize: 11, opacity: 0.4, marginTop: 2 } as React.CSSProperties,
  iconBtn: {
    fontSize: 16,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "6px 8px",
    borderRadius: 8,
    minHeight: 36,
    minWidth: 36,
    transition: "opacity 0.2s",
  } as React.CSSProperties,
  badge: {
    fontSize: 11, padding: "4px 10px", borderRadius: 12, fontWeight: 600,
  } as React.CSSProperties,
  sidebar: { display: "flex", flexDirection: "column" as const, gap: 16 } as React.CSSProperties,
  main: { display: "flex", flexDirection: "column" as const, gap: 16 } as React.CSSProperties,
  card: {
    background: "#13132b",
    borderRadius: 16,
    padding: "clamp(12px, 3vw, 20px)",
    border: "1px solid #1e1e3a",
  } as React.CSSProperties,
  logoutBtn: {
    fontSize: 11,
    background: "none",
    border: "1px solid #2a2a4a",
    cursor: "pointer",
    padding: "6px 10px",
    borderRadius: 8,
    color: "#6666aa",
    fontWeight: 600,
    minHeight: 36,
  } as React.CSSProperties,
} as const;

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#6666aa" }}>
        Loading...
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return <Dashboard user={user} logout={logout} />;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ logout }: { user: { email: string }; logout: () => void }) {
  const { state, connected } = useCognitiveState();
  const { entries, scores } = useTimeline(300);
  const { enabled, supported, permission, request, disable, notify } = useNotifications();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("home");

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
        notify("load_spike", "Cognitive overload warning",
          `Load is at ${Math.round(state.load_score * 100)}% — consider stepping back.`);
      }
    } else {
      highLoadCountRef.current = 0;
    }
  }, [state.load_score, notify]);

  const handleBellClick = async () => {
    if (enabled) disable();
    else { if (permission !== "denied") await request(); }
  };

  const bellStyle: React.CSSProperties = {
    ...S.iconBtn,
    opacity: permission === "denied" ? 0.3 : enabled ? 1 : 0.45,
    outline: enabled ? "1px solid #4a4af044" : "none",
    color: enabled ? "#4a4af0" : "#aaa",
  };
  const gearStyle: React.CSSProperties = {
    ...S.iconBtn,
    opacity: settingsOpen ? 1 : 0.5,
    color: settingsOpen ? "#4a4af0" : "#aaa",
    outline: settingsOpen ? "1px solid #4a4af044" : "none",
  };
  const analyticsStyle: React.CSSProperties = {
    ...S.iconBtn,
    opacity: analyticsOpen ? 1 : 0.5,
    color: analyticsOpen ? "#4a4af0" : "#aaa",
    outline: analyticsOpen ? "1px solid #4a4af044" : "none",
  };
  const badgeStyle: React.CSSProperties = {
    ...S.badge,
    background: connected ? "#4af0a033" : "#f05a4a33",
    color: connected ? "#4af0a0" : "#f05a4a",
  };

  // Which sections are visible (mobile: only active tab; desktop: all)
  const show = (tab: Tab) => ({ className: `tab-section${activeTab === tab ? " tab-active" : ""}` });

  return (
    <div style={S.root} className="clr-root">
      {/* Header */}
      <header style={S.header}>
        <div>
          <div style={S.title}>Cognitive Load Router</div>
          <div style={S.subtitle}>Student productivity intelligence</div>
        </div>
        <div style={S.headerRight}>
          {supported && (
            <button type="button" onClick={handleBellClick}
              title={permission === "denied" ? "Notifications blocked" : enabled ? "Disable notifications" : "Enable notifications"}
              style={bellStyle}>
              {enabled ? "\uD83D\uDD14" : "\uD83D\uDD15"}
            </button>
          )}
          <button type="button" title="Analytics" style={analyticsStyle}
            onClick={() => { setSettingsOpen(false); setAnalyticsOpen(o => !o); }}>▦</button>
          <button type="button" title="Settings" style={gearStyle}
            onClick={() => { setAnalyticsOpen(false); setSettingsOpen(o => !o); }}>⚙</button>
          <span style={badgeStyle}>{connected ? "● Live" : "○ Offline"}</span>
          <button type="button" style={S.logoutBtn} onClick={logout}>Sign out</button>
        </div>
      </header>

      {/* Sidebar — always visible, shows gauge + stats */}
      <aside style={S.sidebar} className="clr-sidebar">
        <div style={S.card}>
          <LoadGauge state={state} />
        </div>
        <div {...show("home")} style={S.card}>
          <StatsCard />
        </div>
      </aside>

      {/* Main content */}
      <main style={S.main}>
        <div {...show("control")} style={S.card}>
          <ControlPanel notify={notify} />
        </div>
        <div {...show("home")} style={S.card}>
          <DirectivesFeed />
        </div>
        <div {...show("timeline")} style={S.card}>
          <CognitiveTimeline scores={scores} entries={entries} />
        </div>
        <div {...show("timeline")} style={S.card}>
          <TimelineReplay />
        </div>
        <div {...show("tasks")} style={S.card}>
          <TaskQueue />
        </div>
      </main>

      {/* Bottom tab bar — mobile only (hidden on desktop via CSS) */}
      <nav className="tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`tab-bar-btn${activeTab === tab.id ? " active" : ""}`}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === "more") { setAnalyticsOpen(false); setSettingsOpen(o => !o); }
            }}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Drawers */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {analyticsOpen && <AnalyticsPanel onClose={() => setAnalyticsOpen(false)} />}
    </div>
  );
}
