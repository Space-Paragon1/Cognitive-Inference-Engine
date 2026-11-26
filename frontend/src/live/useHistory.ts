/* Sessions and per-session timelines for History. Both are kept in memory for the
   visit, so a session that has been opened once still replays while offline. */
import { useCallback, useEffect, useState } from "react";
import { getSessions, getTimeline } from "../api/client";
import type { SessionSummary, TimelineEntry } from "../types";
import { toTicks } from "../lib/history";
import type { ReplayTick } from "../lib/history";
import { onAccountReset } from "../lib/accountReset";

const DAYS = 14;
const PAGE = 1000; // the engine's maximum page size
const MAX_PAGES = 30;

let sessionCache: SessionSummary[] | null = null;
const timelineCache = new Map<number, { entries: TimelineEntry[]; ticks: ReplayTick[]; at: number }>();
onAccountReset(() => {
  sessionCache = null;
  timelineCache.clear();
});

/** Sessions from the last two weeks, newest first. Refreshed every minute. */
export function useSessionList(refreshMs = 60000) {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(sessionCache);
  const [loading, setLoading] = useState(sessionCache == null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const since = Math.floor(Date.now() / 1000) - DAYS * 86400;
      const list = (await getSessions({ since })).slice().sort((a, b) => b.start_ts - a.start_ts);
      sessionCache = list;
      setSessions(list);
      setError(false);
    } catch {
      // Keep showing what we had; only a first load with nothing cached is an error.
      setError(sessionCache == null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, refreshMs);
    return () => window.clearInterval(t);
  }, [load, refreshMs]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(false);
    load();
  }, [load]);

  return { sessions, loading, error, retry };
}

/** Every timeline row in [since, until]. The API returns newest first, at most 1000 a page. */
async function fetchWindow(since: number, until: number): Promise<TimelineEntry[]> {
  const out: TimelineEntry[] = [];
  let upper = until;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await getTimeline({ since, until: upper, limit: PAGE });
    out.push(...page);
    if (page.length < PAGE) break;
    const oldest = Math.min(...page.map((e) => e.timestamp));
    if (oldest <= since) break;
    upper = oldest - 0.001;
  }
  return out;
}

/** The ticks and raw events of one session. A running session refreshes every 10 s. */
export function useSessionTimeline(session: SessionSummary | null, running: boolean) {
  const key = session?.start_ts ?? null;
  const cached = key != null ? timelineCache.get(key) : undefined;
  const [data, setData] = useState(cached ?? null);
  const [loading, setLoading] = useState(key != null && !cached);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      // Running sessions grow, so read up to now rather than the summary's end.
      const until = running ? Date.now() / 1000 : session.end_ts + 1;
      const entries = await fetchWindow(session.start_ts - 1, until);
      const next = { entries, ticks: toTicks(entries), at: Date.now() };
      timelineCache.set(session.start_ts, next);
      setData(next);
      setError(false);
    } catch {
      setError(!timelineCache.has(session.start_ts));
    } finally {
      setLoading(false);
    }
  }, [session, running]);

  useEffect(() => {
    if (key == null) {
      setData(null);
      setLoading(false);
      return;
    }
    const hit = timelineCache.get(key);
    setData(hit ?? null);
    setLoading(!hit);
    setError(false);
    // A finished session never changes, so the cached copy is final.
    if (!hit || running) load();
    if (!running) return;
    const t = window.setInterval(load, 10000);
    return () => window.clearInterval(t);
  }, [key, running, load]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(false);
    load();
  }, [load]);

  return { entries: data?.entries ?? [], ticks: data?.ticks ?? [], loading, error, retry };
}
