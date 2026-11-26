/* Privacy actions from Settings: export and delete.
   TODO(backend): the engine has no export or delete-account endpoint. Export is
   assembled here from the endpoints that exist; delete is a stub that changes
   nothing and says so. Both live in this one file so the real calls drop in here. */
import { getDailyStats, getSessions, getSettings, getTasks, getTimeline, listDevices } from "./client";
import type { AuthUser, TimelineEntry } from "../types";

const DAY = 86400;
/** How far back the timeline export reaches until a server export exists. */
const TIMELINE_DAYS = 30;

async function timelineSince(since: number): Promise<TimelineEntry[]> {
  const out: TimelineEntry[] = [];
  let until = Date.now() / 1000;
  for (let i = 0; i < 200; i++) {
    const page = await getTimeline({ since, until, limit: 1000 });
    out.push(...page);
    if (page.length < 1000) break;
    until = Math.min(...page.map((e) => e.timestamp)) - 0.001;
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

export interface DataExport {
  json: string;
  csv: string;
}

/** Everything the API can return about the student, as JSON plus a CSV of the timeline. */
export async function exportMyData(user: AuthUser | null): Promise<DataExport> {
  const now = Math.floor(Date.now() / 1000);
  const [settings, tasks, devices, sessions, daily, timeline] = await Promise.all([
    getSettings(),
    getTasks(),
    listDevices(),
    getSessions({ since: 1 }),
    getDailyStats({ since: 1 }),
    timelineSince(now - TIMELINE_DAYS * DAY),
  ]);
  const json = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      account: user ? { email: user.email, created_at: user.created_at } : null,
      settings: settings.settings,
      tasks: tasks.tasks,
      connected_sources: devices,
      sessions,
      daily_stats: daily,
      timeline_last_30_days: timeline,
    },
    null,
    2
  );
  const head = "timestamp,iso_time,source,event_type,load_score,context";
  const csv = [head, ...timeline.map((e) => [e.timestamp, new Date(e.timestamp * 1000).toISOString(), e.source, e.event_type, e.load_score.toFixed(4), e.context].join(","))].join("\n");
  return { json, csv };
}

export class NotAvailableError extends Error {
  constructor() {
    super("Deleting all data needs an engine endpoint that does not exist yet.");
    this.name = "NotAvailableError";
  }
}

/** TODO(backend): DELETE /auth/me (or similar) that removes sessions, events, tasks, settings and the account. */
export async function deleteMyData(): Promise<never> {
  throw new NotAvailableError();
}
