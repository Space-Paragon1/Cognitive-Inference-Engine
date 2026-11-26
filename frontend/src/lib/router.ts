/* Hash routes named after `Route` in index.d.ts: #/now, #/focus, #/settings/sources.
   Hash routing works from file:// in the Capacitor WebView without server rewrites. */
import { useCallback, useSyncExternalStore } from "react";
import type { Route } from "../types/ui";

export const ROUTES: Route[] = ["now", "focus", "tasks", "history", "insights", "settings", "more"];

export interface Location {
  route: Route;
  /** Optional sub-section, e.g. "sources" in #/settings/sources. */
  sub: string | null;
}

const EVENT = "clr:route";

function parse(hash: string): Location {
  const [head, sub] = hash.replace(/^#\/?/, "").split("/");
  const route = (ROUTES as string[]).includes(head) ? (head as Route) : "now";
  return { route, sub: sub || null };
}

function subscribe(fn: () => void) {
  window.addEventListener("hashchange", fn);
  window.addEventListener(EVENT, fn);
  return () => {
    window.removeEventListener("hashchange", fn);
    window.removeEventListener(EVENT, fn);
  };
}

const readHash = () => window.location.hash;

export function href(route: Route, sub?: string | null) {
  return `#/${route}${sub ? `/${sub}` : ""}`;
}

export function navigate(route: Route, sub?: string | null, opts: { replace?: boolean } = {}) {
  const next = href(route, sub);
  if (window.location.hash === next) return;
  if (opts.replace) {
    window.history.replaceState(null, "", next);
    window.dispatchEvent(new Event(EVENT));
  } else {
    window.location.hash = next;
  }
}

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, readHash, readHash);
  const loc = parse(hash);
  const go = useCallback((route: Route, sub?: string | null, opts?: { replace?: boolean }) => navigate(route, sub, opts), []);
  return { ...loc, navigate: go };
}

/** Where a sub-page goes back to on mobile (More holds History and Settings). */
export function parentRoute(route: Route, mobile: boolean): Route | null {
  if (mobile && (route === "history" || route === "settings")) return "more";
  return null;
}

/** The tab that lights up for a route on mobile. */
export function mobileTab(route: Route): Exclude<Route, "history" | "settings"> {
  if (route === "history" || route === "settings") return "more";
  return route;
}
