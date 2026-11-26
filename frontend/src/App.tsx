import { useEffect, useState } from "react";
import { useAuth } from "./auth/AuthContext";
import { LoginPage, SESSION_EXPIRED_KEY } from "./components/LoginPage";
import { AppShell, useLayout } from "./components/Shell";
import { Spinner } from "./components/Spinner";
import { ToastProvider } from "./components/Toast";
import { exitApp, useHardwareBack } from "./lib/backStack";
import { navigate, parentRoute, useRoute } from "./lib/router";
import { DirectivesProvider } from "./live/DirectivesState";
import { LiveStateProvider, useLive } from "./live/LiveState";
import { PrefsProvider } from "./live/PrefsState";
import { SettingsProvider } from "./live/SettingsState";
import { TasksProvider } from "./live/TasksState";
import { TimerProvider } from "./live/TimerState";
import { FocusScreen } from "./screens/Focus/FocusScreen";
import { NowScreen } from "./screens/Now/NowScreen";
import { TasksScreen } from "./screens/Tasks/TasksScreen";
import { HistoryScreen } from "./screens/History/HistoryScreen";
import { InsightsScreen } from "./screens/Insights/InsightsScreen";
import { SettingsScreen } from "./screens/Settings/SettingsScreen";
import { MoreScreen } from "./screens/More/MoreScreen";
import { Onboarding } from "./screens/Onboarding/Onboarding";
import { markOnboarded, onboardingDue } from "./lib/onboarding";
import type { Route } from "./types/ui";
import styles from "./App.module.css";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className={styles.boot} role="status" aria-label="Loading">
        <Spinner size={24} />
      </div>
    );
  }
  return (
    <ToastProvider>
      {user ? (
        <LiveStateProvider key={user.id}>
          <SettingsProvider>
            <PrefsProvider>
              <TimerProvider>
                <TasksProvider>
                  <DirectivesProvider>
                    <SignedIn />
                  </DirectivesProvider>
                </TasksProvider>
              </TimerProvider>
            </PrefsProvider>
          </SettingsProvider>
        </LiveStateProvider>
      ) : (
        <LoginPage />
      )}
    </ToastProvider>
  );
}

function SignedIn() {
  const { user, logout } = useAuth();
  const authFailed = useLive((s) => s.authFailed);
  const [onboarding, setOnboarding] = useState(() => !!user && onboardingDue(user));

  // The socket refused our token (4001): the session has ended on the engine.
  useEffect(() => {
    if (!authFailed) return;
    try {
      sessionStorage.setItem(SESSION_EXPIRED_KEY, "1");
    } catch {
      /* storage blocked */
    }
    logout();
  }, [authFailed, logout]);

  if (onboarding && user) {
    return (
      <Onboarding
        onDone={() => {
          markOnboarded(user.id);
          navigate("now", null, { replace: true });
          setOnboarding(false);
        }}
      />
    );
  }
  return <MainApp />;
}

function MainApp() {
  const { route, sub } = useRoute();
  const layout = useLayout();
  const mobile = layout === "mobile";

  useAndroidBack(route, sub, mobile);

  // More is the phone's overflow tab; wider layouts have everything in the sidebar.
  useEffect(() => {
    if (!mobile && route === "more") navigate("now", null, { replace: true });
  }, [mobile, route]);

  return (
    <AppShell route={route} sub={sub}>
      {/* On phones each History level (list, session, event log) is its own page. */}
      <Screen key={mobile && route === "history" ? `${route}/${sub ?? ""}` : route} route={route} sub={sub} />
    </AppShell>
  );
}

function Screen({ route, sub }: { route: Route; sub: string | null }) {
  switch (route) {
    case "now":
      return <NowScreen />;
    case "focus":
      return <FocusScreen />;
    case "tasks":
      return <TasksScreen />;
    case "history":
      return <HistoryScreen sub={sub} />;
    case "insights":
      return <InsightsScreen />;
    case "settings":
      return <SettingsScreen sub={sub} />;
    case "more":
      return <MoreScreen />;
  }
}

/** Android back: close a sheet, then pop a sub-page, then go to Now; from Now, exit. */
function useAndroidBack(route: Route, sub: string | null, mobile: boolean) {
  useHardwareBack(() => {
    const parent = parentRoute(route, mobile, sub);
    if (parent) navigate(parent.route, parent.sub, { replace: true });
    else if (route !== "now") navigate("now", null, { replace: true });
    else exitApp();
  });
}
