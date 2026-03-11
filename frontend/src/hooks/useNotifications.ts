import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useCallback, useRef, useState } from "react";
import { setDnD } from "../api/client";

// Minimum ms between repeat notifications of the same key
const COOLDOWN: Record<string, number> = {
  stuck:        5 * 60_000,
  fatigue:      5 * 60_000,
  recovering:  10 * 60_000,
  deep_focus:  10 * 60_000,
  shallow_work:15 * 60_000,
  load_spike:  10 * 60_000,
  pomodoro:     0,           // phase transitions fire exactly once per transition
};

const isNative = Capacitor.isNativePlatform();

function webSupported() {
  return !isNative && "Notification" in window;
}

let notifIdCounter = 1;

async function fireNative(title: string, body?: string) {
  await LocalNotifications.schedule({
    notifications: [
      {
        id: notifIdCounter++,
        title,
        body: body ?? "",
        schedule: { at: new Date(Date.now() + 100) },
        sound: undefined,
        smallIcon: "ic_stat_icon_config_sample",
      },
    ],
  });
}

export function useNotifications() {
  const [enabled, setEnabled] = useState(() => {
    if (isNative) return localStorage.getItem("notif_enabled") === "1";
    if (!webSupported()) return false;
    return (
      localStorage.getItem("notif_enabled") === "1" &&
      Notification.permission === "granted"
    );
  });

  const lastFiredRef = useRef<Record<string, number>>({});

  /** Ask for permission and enable. Returns true if granted. */
  const request = useCallback(async (): Promise<boolean> => {
    if (isNative) {
      const result = await LocalNotifications.requestPermissions();
      if (result.display === "granted") {
        setEnabled(true);
        localStorage.setItem("notif_enabled", "1");
        return true;
      }
      return false;
    }
    if (!webSupported()) return false;
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setEnabled(true);
      localStorage.setItem("notif_enabled", "1");
      setDnD(true).catch(() => {});
      return true;
    }
    return false;
  }, []);

  const disable = useCallback(() => {
    setEnabled(false);
    localStorage.setItem("notif_enabled", "0");
    if (!isNative) setDnD(false).catch(() => {});
  }, []);

  /**
   * Fire a notification unless it was fired too recently.
   * @param key   Cooldown bucket
   * @param title Notification title
   * @param body  Optional body text
   */
  const notify = useCallback(
    (key: string, title: string, body?: string) => {
      if (!enabled) return;
      const now = Date.now();
      const cooldown = COOLDOWN[key] ?? 5 * 60_000;
      if (cooldown > 0 && (lastFiredRef.current[key] ?? 0) + cooldown > now) return;
      lastFiredRef.current[key] = now;

      if (isNative) {
        fireNative(title, body).catch(() => {});
      } else {
        if (Notification.permission !== "granted") return;
        new Notification(title, { body, silent: false });
      }
    },
    [enabled]
  );

  // Derive permission string for UI
  const permission = isNative
    ? enabled ? "granted" : "default"
    : webSupported() ? Notification.permission : "denied";

  return {
    enabled,
    supported: isNative || webSupported(),
    permission,
    request,
    disable,
    notify,
  };
}
