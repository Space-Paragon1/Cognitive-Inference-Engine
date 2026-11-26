/* One week of Insights data: daily stats, last week's focus for the comparison, and
   the week's sessions (for the best-hours grid). Weeks run Monday to Sunday. Each
   week is kept in memory for the visit, so going back and forth is instant and the
   numbers stay up offline. */
import { useCallback, useEffect, useState } from "react";
import { getDailyStats, getSessions } from "../api/client";
import type { DailyStats, SessionSummary } from "../types";
import { addDays, weekStart } from "../lib/insights";
import { onAccountReset } from "../lib/accountReset";

export interface WeekData {
  stats: DailyStats[];
  /** The week before, for the comparison under total focus time. */
  lastWeek: DailyStats[];
  sessions: SessionSummary[];
}

const cache = new Map<number, WeekData>();
onAccountReset(() => cache.clear());

export function useWeek(offset: number) {
  const start = weekStart(offset);
  const key = start.getTime();
  const [data, setData] = useState<WeekData | null>(cache.get(key) ?? null);
  const [loading, setLoading] = useState(!cache.has(key));
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const since = key / 1000;
    const until = addDays(new Date(key), 7).getTime() / 1000 - 1;
    const prevSince = addDays(new Date(key), -7).getTime() / 1000;
    try {
      const [stats, prev, sessions] = await Promise.all([
        getDailyStats({ since, until }),
        getDailyStats({ since: prevSince, until: since - 1 }),
        getSessions({ since, until }),
      ]);
      const next: WeekData = { stats, lastWeek: prev, sessions };
      cache.set(key, next);
      setData(next);
      setError(false);
    } catch {
      setError(!cache.has(key));
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    const hit = cache.get(key);
    setData(hit ?? null);
    setLoading(!hit);
    setError(false);
    load();
    // This week keeps changing; refresh it every few minutes.
    if (offset !== 0) return;
    const t = window.setInterval(load, 5 * 60000);
    return () => window.clearInterval(t);
  }, [key, offset, load]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(false);
    load();
  }, [load]);

  return { start, data, loading, error, retry };
}
