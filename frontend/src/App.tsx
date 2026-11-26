import { useEffect, useRef } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "./auth/AuthContext";
import { LoginPage } from "./components/LoginPage";
import { AppShell, useLayout } from "./components/Shell";
import { Spinner } from "./components/Spinner";
import { ToastProvider } from "./components/Toast";
import { runBack } from "./lib/backStack";
import { navigate, parentRoute, useRoute } from "./lib/router";
import { DirectivesProvider } from "./live/DirectivesState";
import { LiveStateProvider, useLive } from "./live/LiveState";
import { PrefsProvider } from "./live/PrefsState";
import { SettingsProvider } from "./live/SettingsState";
import { TasksProvider } from "./live/TasksState";
import { TimerProvider } from "./live/TimerState";
import { FocusScreen } from "./screens/Focus/FocusScreen";
import { NowScreen } from "./screens/Now/NowScreen";
import { Placeholder } from "./screens/Placeholder";
import { TasksScreen } from "./screens/Tasks/TasksScreen";
import type { Route } from "./types/ui";
import styles from "./App.module.css";

export const SESSION_EXPIRED_KEY = "clr_session_expired";

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
  const { route, sub } = useRoute();
  const layout = useLayout();
  const mobile = layout === "mobile";
  const { logout } = useAuth();
  const authFailed = useLive((s) => s.authFailed);

  useAndroidBack(route, mobile);

  // More is the phone's overflow tab; wider layouts have everything in the sidebar.
  useEffect(() => {
    if (!mobile && route === "more") navigate("now", null, { replace: true });
  }, [mobile, route]);

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

  return (
    <AppShell route={route}>
      <Screen key={route} route={route} sub={sub} />
    </AppShell>
  );
}

function Screen({ route }: { route: Route; sub: string | null }) {
  switch (route) {
    case "now":
      return <NowScreen />;
    case "focus":
      return <FocusScreen />;
    case "tasks":
      return <TasksScreen />;
    case "history":
      return <Placeholder title="History" />;
    case "insights":
      return <Placeholder title="Insights" />;
    case "settings":
      return <Placeholder title="Settings" />;
    case "more":
      return <Placeholder title="More" />;
  }
}

/** Android back: close a sheet, then pop a sub-page, then go to Now; from Now, exit. */
function useAndroidBack(route: Route, mobile: boolean) {
  const ref = useRef({ route, mobile });
  ref.current = { route, mobile };
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapApp.addListener("backButton", () => {
      if (runBack()) return;
      const { route: r, mobile: m } = ref.current;
      const parent = parentRoute(r, m);
      if (parent) navigate(parent, null, { replace: true });
      else if (r !== "now") navigate("now", null, { replace: true });
      else CapApp.exitApp();
    });
    return () => {
      handle.then((h) => h.remove());
    };
  }, []);
}
