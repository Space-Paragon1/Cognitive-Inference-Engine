import { describe, expect, it } from "vitest";
import { greeting, orderRule, orderTasks, pomodoroMinutes, upNextWhy, whyLine } from "./order";

const HIGH = 0.65;
const FATIGUE = 0.85;
const t = (id: string, difficulty: "easy" | "medium" | "hard" | "review") => ({ id, difficulty });

describe("orderRule", () => {
  it("uses the high rule at and above the threshold", () => {
    expect(orderRule(HIGH, HIGH)).toBe("high");
    expect(orderRule(0.9, HIGH)).toBe("high");
  });
  it("uses the low rule under 40%", () => {
    expect(orderRule(0.39, HIGH)).toBe("low");
    expect(orderRule(0.4, HIGH)).toBe("normal");
  });
});

describe("orderTasks", () => {
  const tasks = [t("h", "hard"), t("e", "easy"), t("m", "medium"), t("r", "review")];

  it("puts easy and review first under high load", () => {
    expect(orderTasks(tasks, 0.8, HIGH).map((x) => x.id)).toEqual(["e", "r", "m", "h"]);
  });
  it("puts hard first under low load", () => {
    expect(orderTasks(tasks, 0.2, HIGH).map((x) => x.id)).toEqual(["h", "m", "r", "e"]);
  });
  it("puts medium first with hard close behind otherwise", () => {
    expect(orderTasks(tasks, 0.5, HIGH).map((x) => x.id)).toEqual(["m", "h", "r", "e"]);
  });
  it("keeps the student's order within a difficulty", () => {
    const same = [t("a", "hard"), t("b", "hard"), t("c", "hard")];
    expect(orderTasks(same, 0.2, HIGH).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("does not change the list it was given", () => {
    const copy = [...tasks];
    orderTasks(tasks, 0.8, HIGH);
    expect(tasks).toEqual(copy);
  });
});

describe("pomodoroMinutes", () => {
  it("shortens as load rises", () => {
    expect(pomodoroMinutes(0.3, HIGH, FATIGUE)).toBe(35);
    expect(pomodoroMinutes(0.5, HIGH, FATIGUE)).toBe(25);
    expect(pomodoroMinutes(0.7, HIGH, FATIGUE)).toBe(15);
    expect(pomodoroMinutes(0.9, HIGH, FATIGUE)).toBe(10);
  });
});

describe("whyLine", () => {
  it("explains a missing reading", () => {
    expect(whyLine(25, null, HIGH, FATIGUE)).toBe("25 min because CLR has no reading yet, so it uses your normal length.");
  });
  it("names the band and the load", () => {
    expect(whyLine(15, 0.78, HIGH, FATIGUE)).toBe("15 min because your load is high (78%).");
    expect(whyLine(10, 0.9, HIGH, FATIGUE)).toBe("10 min because your load is showing fatigue (90%).");
  });
  it("flags a rough estimate", () => {
    expect(whyLine(25, 0.5, HIGH, FATIGUE, 0.3)).toMatch(/rough estimate\.$/);
  });
});

describe("upNextWhy", () => {
  it("follows the order rule", () => {
    expect(upNextWhy(0.2, HIGH)).toMatch(/^Load is low \(20%\)/);
    expect(upNextWhy(0.8, HIGH)).toMatch(/^Easy and review work suits a high 80%/);
    expect(upNextWhy(0.5, HIGH)).toMatch(/^Medium work suits a steady 50%/);
  });
  it("works without sources", () => {
    expect(upNextWhy(null, HIGH)).toMatch(/without sources/);
  });
});

describe("greeting", () => {
  it("follows the time of day", () => {
    expect(greeting(new Date(2026, 10, 23, 8))).toBe("Good morning");
    expect(greeting(new Date(2026, 10, 23, 13))).toBe("Good afternoon");
    expect(greeting(new Date(2026, 10, 23, 21))).toBe("Good evening");
    expect(greeting(new Date(2026, 10, 23, 3))).toBe("Good evening");
  });
});
