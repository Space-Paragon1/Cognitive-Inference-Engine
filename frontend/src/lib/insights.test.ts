import { describe, expect, it } from "vitest";
import type { DailyStats, SessionSummary } from "../types";
import { addDays, bestWindow, dateKey, dayRows, heatGrid, hourRange, kpis, reflection, weekLabel, weekStart } from "./insights";

// Monday 23 November 2026, local time.
const MONDAY = new Date(2026, 10, 23);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, 23 + day, hour, minute).getTime() / 1000;

function stats(date: string, over: Partial<DailyStats> = {}): DailyStats {
  return {
    date,
    tick_count: 100,
    session_count: 1,
    avg_load_score: 0.5,
    peak_load_score: 0.8,
    total_session_minutes: 60,
    focus_minutes: 40,
    context_distribution: { deep_focus: 0.6, shallow_work: 0.4 },
    ...over,
  };
}

function session(start: number, end: number, deep = 1): SessionSummary {
  return {
    session_index: 0,
    start_ts: start,
    end_ts: end,
    duration_minutes: (end - start) / 60,
    tick_count: 10,
    avg_load_score: 0.5,
    peak_load_score: 0.7,
    context_distribution: { deep_focus: deep },
    dominant_context: "deep_focus",
  };
}

describe("weeks", () => {
  it("starts on Monday at midnight", () => {
    const thursday = new Date(2026, 10, 26, 15, 30);
    expect(weekStart(0, thursday)).toEqual(MONDAY);
    expect(weekStart(-1, thursday)).toEqual(new Date(2026, 10, 16));
  });
  it("treats Sunday as the end of the week", () => {
    expect(weekStart(0, new Date(2026, 10, 29, 22))).toEqual(MONDAY);
  });
  it("keys days by local date", () => {
    expect(dateKey(addDays(MONDAY, 6))).toBe("2026-11-29");
  });
  it("labels weeks within and across months", () => {
    expect(weekLabel(new Date(2026, 10, 16))).toBe("16 – 22 November");
    expect(weekLabel(new Date(2026, 9, 26))).toBe("26 October – 1 November");
  });
});

describe("dayRows and kpis", () => {
  const now = new Date(2026, 10, 25, 12);
  const days = dayRows(MONDAY, [stats("2026-11-23"), stats("2026-11-24", { focus_minutes: 90, total_session_minutes: 120 })], now);

  it("makes seven rows and marks days still to come", () => {
    expect(days).toHaveLength(7);
    expect(days[0].focusMinutes).toBe(40);
    expect(days[2].sessions).toBe(0);
    expect(days[2].avgLoad).toBeNull();
    expect(days[3].future).toBe(true);
  });
  it("picks the day's top context", () => {
    expect(days[0].top).toBe("deep_focus");
  });
  it("totals focus and compares with last week", () => {
    const k = kpis(days, 60);
    expect(k.focusHours).toBeCloseTo(130 / 60);
    expect(k.vsLastWeek).toBeCloseTo(70 / 60);
    expect(k.best?.short).toBe("Tue");
    expect(k.avgLoad).toBeCloseTo(0.5);
  });
  it("has no comparison without last week's numbers", () => {
    expect(kpis(days, null).vsLastWeek).toBeNull();
  });
});

describe("heatGrid", () => {
  it("spreads a session over the hours it covers", () => {
    const g = heatGrid([session(at(0, 9, 30), at(0, 11))], MONDAY);
    expect(g.minutes[0][9]).toBeCloseTo(30);
    expect(g.minutes[0][10]).toBeCloseTo(60);
    expect(g.peak).toEqual({ day: 0, hour: 10 });
    expect(g.level[0][10]).toBe(4);
  });
  it("weights by the deep-focus share", () => {
    const g = heatGrid([session(at(1, 14), at(1, 15), 0.5)], MONDAY);
    expect(g.minutes[1][14]).toBeCloseTo(30);
  });
  it("ignores sessions outside the week", () => {
    const g = heatGrid([session(at(-1, 9), at(-1, 10))], MONDAY);
    expect(g.max).toBe(0);
    expect(g.peak).toBeNull();
  });
  it("widens the hour range for early focus", () => {
    const g = heatGrid([session(at(0, 5), at(0, 6))], MONDAY);
    expect(hourRange(g)).toEqual([5, 23]);
  });
});

describe("bestWindow", () => {
  it("finds the best two hours", () => {
    const row = new Array(24).fill(0);
    row[9] = 30;
    row[10] = 50;
    expect(bestWindow(row)).toBe("9 – 11 am");
  });
  it("writes both halves of the day across noon", () => {
    const row = new Array(24).fill(0);
    row[11] = 40;
    row[12] = 40;
    expect(bestWindow(row)).toBe("11 am – 1 pm");
  });
  it("returns nothing for an empty row", () => {
    expect(bestWindow(new Array(24).fill(0))).toBeNull();
  });
});

describe("reflection", () => {
  const g = heatGrid([session(at(1, 9), at(1, 11))], MONDAY);

  it("is empty for a week with no sessions", () => {
    expect(reflection(dayRows(MONDAY, []), g, 0.65)).toBeNull();
  });
  it("names the strongest day and the best window", () => {
    const days = dayRows(MONDAY, [stats("2026-11-24", { focus_minutes: 120 })]);
    const r = reflection(days, g, 0.65);
    expect(r?.strongest).toBe("Tuesday was your strongest day, with 2.0 hours.");
    expect(r?.window).toBe("9 and 11 am");
  });
  it("points out a day spent stuck", () => {
    const days = dayRows(MONDAY, [stats("2026-11-25", { context_distribution: { stuck: 0.3, deep_focus: 0.7 } })]);
    expect(reflection(days, g, 0.65)?.more).toMatch(/^On Wednesday you got stuck more often/);
  });
});
