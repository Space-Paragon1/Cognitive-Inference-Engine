/* System notifications: asking for permission and posting, on Android (Capacitor
   local notifications) and on the web (Notification API). In-app toasts cover the
   visible app; these are for when CLR is in the background. */
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const native = Capacitor.isNativePlatform();
let nextId = 1;

export type NotifyPermission = "granted" | "denied" | "default" | "unsupported";

export async function notificationPermission(): Promise<NotifyPermission> {
  try {
    if (native) {
      const p = await LocalNotifications.checkPermissions();
      return p.display === "granted" ? "granted" : p.display === "denied" ? "denied" : "default";
    }
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  } catch {
    return "unsupported";
  }
}

/** Shows the system prompt (Android 13+ or the browser). Resolves true when allowed. */
export async function requestNotifications(): Promise<boolean> {
  try {
    if (native) return (await LocalNotifications.requestPermissions()).display === "granted";
    if (!("Notification" in window)) return false;
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export interface SystemNotification {
  title: string;
  body: string;
  /** Replaces an earlier notification with the same tag (web). */
  tag?: string;
}

/** Posts a notification if allowed. Resolves false when it couldn't. */
export async function postNotification(n: SystemNotification): Promise<boolean> {
  try {
    if (native) {
      if ((await LocalNotifications.checkPermissions()).display !== "granted") return false;
      await LocalNotifications.schedule({ notifications: [{ id: nextId++, title: n.title, body: n.body, schedule: { at: new Date(Date.now() + 100) } }] });
      return true;
    }
    if (!("Notification" in window) || Notification.permission !== "granted") return false;
    new Notification(n.title, { body: n.body, tag: n.tag });
    return true;
  } catch {
    return false;
  }
}
