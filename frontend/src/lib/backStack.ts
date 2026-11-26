/* Android back (and Esc-like dismissals) in one ordered stack.
   Sheets register while open; App.tsx registers sub-page pops. The hardware
   back button runs the top handler, then falls back to the route rules. */
import { useEffect, useRef } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

type Handler = () => void;
const handlers: Handler[] = [];

export function registerBack(handler: Handler): () => void {
  handlers.push(handler);
  return () => {
    const i = handlers.lastIndexOf(handler);
    if (i >= 0) handlers.splice(i, 1);
  };
}

/** Run the most recently registered handler. Returns false when nothing was open. */
export function runBack(): boolean {
  const top = handlers[handlers.length - 1];
  if (!top) return false;
  top();
  return true;
}

/** Register `onBack` while `active` is true. */
export function useBackHandler(active: boolean, onBack: () => void) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    return registerBack(() => ref.current());
  }, [active]);
}

/** The Android hardware back button: open sheets first, then `fallback`. */
export function useHardwareBack(fallback: () => void) {
  const ref = useRef(fallback);
  ref.current = fallback;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapApp.addListener("backButton", () => {
      if (!runBack()) ref.current();
    });
    return () => {
      handle.then((h) => h.remove());
    };
  }, []);
}

export const exitApp = () => CapApp.exitApp();
