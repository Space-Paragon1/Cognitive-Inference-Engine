/* Today at a glance: focus time, average load, sessions and the context mix. */
import { useCallback, useEffect, useState } from "react";
import { getDailyStats, getSessions } from "../api/client";
import type { CognitiveContext, SessionSummary } from "../types";

export interface Today {
  focusMinutes: number;
  avgLoad: number | null;
  sessions: number;
  distribution: Partial<Record<CognitiveContext, number>>;
  /** First session start today (ms), for "Since 6:10 pm". */
  since: number | null;
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Weighted context mix across sessions. */
export function mixOf(sessions: SessionSummary[]): Partial<Record<CognitiveContext, number>> {
  const total = sessions.reduce((a, s) => a + s.duration_minutes, 0);
  const out: Partial<Record<CognitiveContext, number>> = {};
  if (!total) return out;
  for (const s of sessions) {
    for (const [k, v] of Object.entries(s.context_distribution)) {
      const key = k as CognitiveContext;
      out[key] = (out[key] ?? 0) + (v * s.duration_minutes) / total;
    }
  }
  return out;
}

export function useToday(refreshMs = 60000) {
  const [today, setToday] = useState<Today | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const since = Math.floor(startOfToday() / 1000);
    try {
      const [days, sessions] = await Promise.all([getDailyStats({ since }), getSessions({ since })]);
      const key = new Date().toISOString().slice(0, 10);
      const day = days.find((d) => d.date === key) ?? days[days.length - 1];
      const mins = sessions.reduce((a, s) => a + s.duration_minutes, 0);
      setToday({
        focusMinutes: day?.focus_minutes ?? 0,
        avgLoad: mins ? sessions.reduce((a, s) => a + s.avg_load_score * s.duration_minutes, 0) / mins : day?.avg_load_score ?? null,
        sessions: sessions.length,
        distribution: sessions.length ? mixOf(sessions) : day?.context_distribution ?? {},
        since: sessions.length ? Math.min(...sessions.map((s) => s.start_ts)) * 1000 : null,
      });
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, refreshMs);
    return () => window.clearInterval(t);
  }, [load, refreshMs]);

  return { today, loading, error, retry: load };
}
