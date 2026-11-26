/* What CLR is doing right now. Polled every 4 s and diffed by action_type, so a
   directive keeps its "since" time and only new ones animate in. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getDirectives } from "../api/client";
import type { TrackedDirective } from "../lib/directives";

interface DirectivesApi {
  items: TrackedDirective[];
  loading: boolean;
  error: boolean;
  /** Directives that arrived since the student last opened the list. */
  unseen: number;
  markSeen: () => void;
  reload: () => void;
}

const DirectivesContext = createContext<DirectivesApi | null>(null);
const POLL_MS = 4000;

export function DirectivesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<TrackedDirective[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const first = useRef(true);

  const reload = useCallback(async () => {
    try {
      const r = await getDirectives();
      const now = Date.now();
      setItems((prev) => {
        const byType = new Map(prev.map((p) => [p.directive.action_type, p]));
        // The engine can send one type twice (different rules); keep the higher priority.
        const next = new Map<string, TrackedDirective>();
        for (const d of r.directives) {
          const existing = next.get(d.action_type);
          if (existing && existing.directive.priority <= d.priority) continue;
          const old = byType.get(d.action_type);
          next.set(d.action_type, old ? { ...old, directive: d } : { directive: d, since: now, fresh: !first.current });
        }
        return [...next.values()];
      });
      if (first.current) {
        setSeen(new Set(r.directives.map((d) => d.action_type)));
        first.current = false;
      }
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const t = window.setInterval(reload, POLL_MS);
    return () => window.clearInterval(t);
  }, [reload]);

  const unseen = items.filter((i) => !seen.has(i.directive.action_type)).length;
  const markSeen = useCallback(() => setSeen(new Set(items.map((i) => i.directive.action_type))), [items]);

  const api = useMemo(() => ({ items, loading, error, unseen, markSeen, reload }), [items, loading, error, unseen, markSeen, reload]);
  return <DirectivesContext.Provider value={api}>{children}</DirectivesContext.Provider>;
}

export function useDirectives(): DirectivesApi {
  const v = useContext(DirectivesContext);
  if (!v) throw new Error("useDirectives must be used inside <DirectivesProvider>");
  return v;
}
