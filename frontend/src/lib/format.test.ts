import { describe, expect, it } from "vitest";
import { ago, clock, initials, minutes, minutesSpoken, mmss, pct } from "./format";

describe("pct", () => {
  it("rounds to a whole percent", () => {
    expect(pct(0.624)).toBe("62%");
    expect(pct(1)).toBe("100%");
  });
});

describe("clock", () => {
  it("writes a 12-hour time with am or pm", () => {
    expect(clock(new Date(2026, 10, 23, 21, 58).getTime())).toBe("9:58 pm");
    expect(clock(new Date(2026, 10, 23, 0, 5).getTime())).toBe("12:05 am");
    expect(clock(new Date(2026, 10, 23, 12, 0).getTime())).toBe("12:00 pm");
  });
});

describe("mmss", () => {
  it("writes minutes and seconds", () => {
    expect(mmss(684)).toBe("11:24");
    expect(mmss(5)).toBe("0:05");
  });
  it("adds hours past an hour", () => {
    expect(mmss(3725)).toBe("1:02:05");
  });
  it("never goes below zero", () => {
    expect(mmss(-3)).toBe("0:00");
  });
});

describe("minutes", () => {
  it("writes minutes under an hour", () => {
    expect(minutes(25)).toBe("25 min");
  });
  it("writes hours and minutes from an hour up", () => {
    expect(minutes(108)).toBe("1 h 48 m");
    expect(minutes(120)).toBe("2 h");
  });
});

describe("minutesSpoken", () => {
  it("spells units out for screen readers", () => {
    expect(minutesSpoken(108)).toBe("1 hour 48 minutes");
    expect(minutesSpoken(60)).toBe("1 hour");
    expect(minutesSpoken(1)).toBe("1 minute");
    expect(minutesSpoken(0)).toBe("0 minutes");
  });
});

describe("ago", () => {
  const now = 1_000_000_000_000;
  it("steps up from seconds to days", () => {
    expect(ago(now - 12_000, now)).toBe("12s");
    expect(ago(now - 4 * 60_000, now)).toBe("4 min");
    expect(ago(now - 2 * 3_600_000, now)).toBe("2 h");
    expect(ago(now - 3 * 86_400_000, now)).toBe("3 days");
  });
});

describe("initials", () => {
  it("takes two letters from the email's local part", () => {
    expect(initials("sam.rivera@example.com")).toBe("SR");
    expect(initials("alex@example.com")).toBe("AL");
    expect(initials(null)).toBe("");
  });
});
