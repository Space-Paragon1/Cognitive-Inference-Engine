import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { CognitiveState } from "../types";
import { sendingSources } from "../lib/sources";
import { LiveStore } from "./store";
import type { LiveSnapshot } from "./store";

const LiveContext = createContext<LiveStore | null>(null);

/** Owns the one LiveStore for the signed-in session. */
export function LiveStateProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new LiveStore());
  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);
  return <LiveContext.Provider value={store}>{children}</LiveContext.Provider>;
}

export function useLiveStore(): LiveStore {
  const store = useContext(LiveContext);
  if (!store) throw new Error("useLive must be used inside <LiveStateProvider>");
  return store;
}

/**
 * Subscribe to a slice of the live snapshot. The component re-renders only when
 * the selected value changes (by `isEqual`, default Object.is).
 */
export function useLive<T>(selector: (s: LiveSnapshot) => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const store = useLiveStore();
  const cache = useRef<{ snap: LiveSnapshot; value: T } | null>(null);
  const read = () => {
    const snap = store.get();
    const c = cache.current;
    if (c && c.snap === snap) return c.value;
    const value = selector(snap);
    if (c && isEqual(c.value, value)) {
      cache.current = { snap, value: c.value };
      return c.value;
    }
    cache.current = { snap, value };
    return value;
  };
  return useSyncExternalStore(store.subscribe, read, read);
}

/** Run `fn` on every reading (alerts). */
export function useLiveTicks(fn: (s: CognitiveState) => void) {
  const store = useLiveStore();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => store.onTick((s) => ref.current(s)), [store]);
}

export const shallowEqual = <T extends object>(a: T, b: T): boolean => {
  if (a === b) return true;
  const ka = Object.keys(a) as (keyof T)[];
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.is(a[k], b[k]));
};

/** False before the first reading, and while the engine has never heard from a source. */
export function hasData(s: CognitiveState | null): s is CognitiveState {
  if (!s) return false;
  const noSources = s.sources != null && Object.keys(s.sources).length === 0;
  return !(s.active === false && noSources);
}

/** The common gauge slice: load (null with no data yet), context, confidence, status. */
export function useGaugeState() {
  return useLive(
    (s) => ({
      load: hasData(s.state) ? s.state.load_score : null,
      context: s.state?.context ?? "unknown",
      confidence: s.state?.confidence ?? 0,
      status: s.status,
      loading: s.loading,
      lastReadingAt: s.lastReadingAt,
    }),
    shallowEqual
  );
}

/** Which sources are sending right now (heard from in the last 2 minutes). */
export function useSources() {
  return useLive((s) => sendingSources(s.state?.sources), shallowEqual);
}
