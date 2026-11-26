/* Hash routes named after `Route` in index.d.ts: #/now, #/focus, #/settings/sources.
   Hash routing works from file:// in the Capacitor WebView without server rewrites. */
import { useCallback, useSyncExternalStore } from "react";
import type { Route } from "../types/ui";

export const ROUTES: Route[] = ["now", "focus", "tasks", "history", "insights", "settings", "more"];

export interface Location {
  route: Route;
  /** Optional sub-path, e.g. "sources" in #/settings/sources or "1732560000/log" in #/history/1732560000/log. */
  sub: string | null;
}

const EVENT = "clr:route";

function parse(hash: string): Location {
  const [head, ...rest] = hash.replace(/^#\/?/, "").split("/");
  const route = (ROUTES as string[]).includes(head) ? (head as Route) : "now";
  const sub = rest.filter(Boolean).join("/");
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

/** Where a page goes back to on mobile. History sits under Insights (Week | History),
    so only its session and event-log pages have a parent; Settings sits under More. */
export function parentRoute(route: Route, mobile: boolean, sub: string | null = null): Location | null {
  if (!mobile) return null;
  // Privacy opens from Settings; everything else in Settings (and Connected sources) from More.
  if (route === "settings") return sub === "privacy" ? { route: "settings", sub: null } : { route: "more", sub: null };
  if (route === "history" && sub) {
    const [session, page] = sub.split("/");
    return page ? { route: "history", sub: session } : { route: "history", sub: null };
  }
  return null;
}

/** The tab that lights up for a route on mobile. */
export function mobileTab(route: Route): Exclude<Route, "history" | "settings"> {
  if (route === "history") return "insights";
  if (route === "settings") return "more";
  return route;
}
