import { useCallback, useRef, useState } from "react";

// Minimum ms between repeat notifications of the same key
const COOLDOWN: Record<string, number> = {
  stuck:      5 * 60_000,
  fatigue:    5 * 60_000,
  recovering: 10 * 60_000,
  deep_focus: 10 * 60_000,
  shallow_work: 15 * 60_000,
  load_spike: 10 * 60_000,
  pomodoro:   0,              // phase transitions fire exactly once per transition
};

function supported() {
  return "Notification" in window;
}

export function useNotifications() {
  const [enabled, setEnabled] = useState(() => {
    if (!supported()) return false;
    return (
      localStorage.getItem("notif_enabled") === "1" &&
      Notification.permission === "granted"
    );
  });

  const lastFiredRef = useRef<Record<string, number>>({});

  /** Ask for permission and enable. Returns true if granted. */
  const request = useCallback(async (): Promise<boolean> => {
    if (!supported()) return false;
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setEnabled(true);
      localStorage.setItem("notif_enabled", "1");
      return true;
    }
    return false;
  }, []);

  const disable = useCallback(() => {
    setEnabled(false);
    localStorage.setItem("notif_enabled", "0");
  }, []);

  /**
   * Fire a notification unless it was fired too recently.
   * @param key   Cooldown bucket — use a context name or a stable string
   * @param title Notification title
   * @param body  Optional body text
   */
  const notify = useCallback(
    (key: string, title: string, body?: string) => {
      if (!enabled || Notification.permission !== "granted") return;
      const now = Date.now();
      const cooldown = COOLDOWN[key] ?? 5 * 60_000;
      if (cooldown > 0 && (lastFiredRef.current[key] ?? 0) + cooldown > now) return;
      lastFiredRef.current[key] = now;
      new Notification(title, { body, silent: false });
    },
    [enabled]
  );

  return {
    enabled,
    supported: supported(),
    permission: supported() ? Notification.permission : "denied",
    request,
    disable,
    notify,
  };
}
