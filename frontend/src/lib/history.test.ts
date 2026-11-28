import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "../types";
import { contextsIn, dayLabel, downsample, isRunning, tickAt, toTicks } from "./history";
import type { ReplayTick } from "./history";

function entry(over: Partial<TimelineEntry>): TimelineEntry {
  return {
    id: null,
    timestamp: 0,
    source: "engine",
    event_type: "inference_tick",
    load_score: 0.5,
    context: "deep_focus",
    metadata_json: "{}",
    ...over,
  };
}

describe("toTicks", () => {
  it("keeps only the engine's ticks, oldest first", () => {
    const ticks = toTicks([
      entry({ timestamp: 30, metadata_json: '{"confidence": 0.4}' }),
      entry({ timestamp: 10 }),
      entry({ timestamp: 20, source: "browser", event_type: "TAB_SWITCH" }),
    ]);
    expect(ticks.map((x) => x.t)).toEqual([10, 30]);
    expect(ticks[1].confidence).toBe(0.4);
  });
  it("treats unreadable metadata and unknown contexts safely", () => {
    const [tick] = toTicks([entry({ metadata_json: "not json", context: "dreaming" })]);
    expect(tick.confidence).toBe(1);
    expect(tick.context).toBe("unknown");
  });
});

describe("tickAt", () => {
  const ticks = [10, 20, 30, 40].map((t) => ({ t, load: 0, context: "unknown", confidence: 1 }) as ReplayTick);

  it("finds the last tick at or before a time", () => {
    expect(tickAt(ticks, 25)).toBe(1);
    expect(tickAt(ticks, 30)).toBe(2);
    expect(tickAt(ticks, 99)).toBe(3);
  });
  it("starts at the first tick", () => {
    expect(tickAt(ticks, 5)).toBe(0);
    expect(tickAt([], 5)).toBe(0);
  });
});

describe("downsample", () => {
  const ticks: ReplayTick[] = Array.from({ length: 10 }, (_, i) => ({
    t: i,
    load: i < 5 ? 0.2 : 0.8,
    context: i < 6 ? "deep_focus" : "stuck",
    confidence: i === 3 ? 0.3 : 1,
  }));

  it("leaves short series alone", () => {
    expect(downsample(ticks, 20)).toBe(ticks);
  });
  it("averages load, keeps the most common context and the lowest confidence", () => {
    const out = downsample(ticks, 2);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ t: 4, load: 0.2, context: "deep_focus", confidence: 0.3 });
    expect(out[1].load).toBeCloseTo(0.8);
    expect(out[1].context).toBe("stuck");
  });
});

describe("dayLabel", () => {
  const now = new Date(2026, 10, 25, 9);
  it("says Today and Yesterday", () => {
    expect(dayLabel(new Date(2026, 10, 25, 1).getTime() / 1000, now)).toBe("Today");
    expect(dayLabel(new Date(2026, 10, 24, 23).getTime() / 1000, now)).toBe("Yesterday");
  });
  it("names older days", () => {
    expect(dayLabel(new Date(2026, 10, 23, 12).getTime() / 1000, now)).toBe("Mon 23");
  });
});

describe("isRunning", () => {
  it("counts a session as running for two minutes after its last tick", () => {
    const s = { end_ts: 1000 } as Parameters<typeof isRunning>[0];
    expect(isRunning(s, 1100)).toBe(true);
    expect(isRunning(s, 1121)).toBe(false);
  });
});

describe("contextsIn", () => {
  it("lists contexts in the fixed order", () => {
    const order = contextsIn([{ context: "stuck" }, { context: "deep_focus" }, { context: "stuck" }]);
    expect(order.indexOf("deep_focus")).toBeLessThan(order.indexOf("stuck"));
    expect(order).toHaveLength(2);
  });
});
