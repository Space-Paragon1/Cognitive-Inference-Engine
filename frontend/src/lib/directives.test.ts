import { describe, expect, it } from "vitest";
import type { ActionDirective, Task } from "../types";
import { directiveReason } from "./directives";
import type { DirectiveContext } from "./directives";
import { countSending, sendingSources, sourcesLine } from "./sources";

const task = (title: string, difficulty: Task["difficulty"]): Task => ({ id: title, title, difficulty, estimated_minutes: 25, tags: [] });
const d = (action_type: string, params: Record<string, unknown> = {}): ActionDirective => ({
  action_type,
  params,
  priority: 1,
  reason: "engine note",
});
const ctx = (over: Partial<DirectiveContext> = {}): DirectiveContext => ({
  load: 0.5,
  context: "deep_focus",
  fatigue: 0.85,
  tasks: [],
  inSession: false,
  ...over,
});

describe("directiveReason", () => {
  it("words silenced notifications by context", () => {
    expect(directiveReason(d("suppress_notifications"), ctx())).toBe("Protecting your deep-focus window.");
    expect(directiveReason(d("suppress_notifications"), ctx({ context: "stuck" }))).toMatch(/work this out/);
  });
  it("says how long the load has been high before a break", () => {
    const r = directiveReason(d("recommend_break", { duration_min: 10 }), ctx({ minutesAboveFatigue: 6.2 }));
    expect(r).toBe("Load has been above 85% for 6 minutes. 10 minutes away will help.");
  });
  it("names a review task when the engine asks for review", () => {
    const tasks = [task("Essay draft", "hard"), task("Flashcards", "review")];
    expect(directiveReason(d("suggest_task", { type: "review" }), ctx({ tasks }))).toBe("“Flashcards” fits how you are doing right now.");
  });
  it("names the hard task it moved", () => {
    expect(directiveReason(d("delay_hard_tasks"), ctx({ tasks: [task("Proofs", "hard")] }))).toBe("Proofs moved down until your load settles.");
  });
  it("falls back to the engine's note for unknown types", () => {
    expect(directiveReason(d("something_new"), ctx())).toBe("engine note");
  });
});

describe("sources", () => {
  const now = 1_000_000 * 1000;
  it("counts a source as sending for two minutes", () => {
    const s = sendingSources({ ide: 1_000_000 - 60, browser: 1_000_000 - 200, toaster: 1_000_000 }, now);
    expect(s).toEqual({ vscode: true });
    expect(countSending(s)).toBe(1);
  });
  it("writes the sources line", () => {
    expect(sourcesLine(0)).toBe("No sources sending");
    expect(sourcesLine(1)).toBe("1 source");
    expect(sourcesLine(3)).toBe("3 sources");
  });
});
