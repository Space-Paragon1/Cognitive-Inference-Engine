import { useCallback, useEffect, useState } from "react";
import { getLoadHistory, getTimeline } from "../api/client";
import type { TimelineEntry } from "../types";

export function useTimeline(windowS = 300) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const since = Date.now() / 1000 - windowS;
      const [e, h] = await Promise.all([
        getTimeline({ since, limit: 200 }),
        getLoadHistory(windowS),
      ]);
      setEntries(e);
      setScores(h.scores);
    } catch {
      // Engine may not be running yet
    } finally {
      setLoading(false);
    }
  }, [windowS]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { entries, scores, loading, refresh };
}
