/* Domain vocabulary from design/README.md and design/voice.md: labels, blurbs and
   Lucide icons for contexts, directives, difficulty, breakdown and sources.
   Use these everywhere so a context is always a colour, an icon and the same word. */
import {
  BatteryLow,
  Bell,
  BellOff,
  ChevronsDown,
  CircleDashed,
  Code,
  Coffee,
  Globe,
  GraduationCap,
  Leaf,
  ListTodo,
  Monitor,
  Mountain,
  Repeat,
  ShieldCheck,
  Target,
  Timer,
  Waves,
} from "lucide-react";
import type { CognitiveContext } from "../types";
import type { Difficulty, DirectiveType, Icon, SourceKind, Tone } from "../types/ui";

export const CTX_ORDER: CognitiveContext[] = [
  "deep_focus",
  "shallow_work",
  "stuck",
  "fatigue",
  "recovering",
  "unknown",
];

export const CTX: Record<CognitiveContext, { label: string; icon: Icon; blurb: string }> = {
  deep_focus: { label: "Deep focus", icon: Target, blurb: "Little switching, steady effort. This is your flow zone." },
  shallow_work: { label: "Shallow work", icon: Waves, blurb: "Your attention is spread across tabs. Good for lighter tasks." },
  stuck: { label: "Stuck", icon: Repeat, blurb: "The same errors keep coming back. A fresh angle might help." },
  fatigue: { label: "Fatigue", icon: BatteryLow, blurb: "Load has stayed high for a long stretch. Resting counts as progress." },
  recovering: { label: "Recovering", icon: Leaf, blurb: "Load is easing after a hard stretch. Ease back in gently." },
  unknown: { label: "Warming up", icon: CircleDashed, blurb: "Still learning how you work today. Give it a minute or two." },
};

/** Narrow any string from the API to a known context. */
export function asContext(value: string | null | undefined): CognitiveContext {
  return value && value in CTX ? (value as CognitiveContext) : "unknown";
}

/** Directive tone: a design tone, or a context whose colours it borrows. */
export type DirectiveTone = Tone | { ctx: CognitiveContext };

export const DIRECTIVES: Record<DirectiveType, { label: string; icon: Icon; tone: DirectiveTone }> = {
  recommend_break: { label: "Take a break", icon: Coffee, tone: "rest" },
  suppress_notifications: { label: "Notifications silenced", icon: BellOff, tone: "accent" },
  block_distracting_tabs: { label: "Distracting tabs blocked", icon: ShieldCheck, tone: "accent" },
  suggest_task: { label: "Suggested task", icon: ListTodo, tone: "accent" },
  shorten_focus_interval: { label: "Shorter focus session", icon: Timer, tone: { ctx: "fatigue" } },
  delay_hard_tasks: { label: "Hard tasks deferred", icon: ChevronsDown, tone: { ctx: "shallow_work" } },
  schedule_hard_task: { label: "Good time for hard work", icon: Mountain, tone: { ctx: "deep_focus" } },
  allow_notifications: { label: "Notifications OK", icon: Bell, tone: "positive" },
};

export function isDirectiveType(value: string): value is DirectiveType {
  return value in DIRECTIVES;
}

/** data-ctx / data-tone attributes for a directive or banner tone. */
export function toneAttrs(tone: DirectiveTone | undefined, context?: CognitiveContext) {
  if (context) return { "data-ctx": context };
  if (tone && typeof tone === "object") return { "data-ctx": tone.ctx };
  return { "data-tone": tone ?? "accent" };
}

export const DIFFICULTY: Record<Difficulty, { label: string; bars: number }> = {
  easy: { label: "Easy", bars: 1 },
  medium: { label: "Medium", bars: 2 },
  hard: { label: "Hard", bars: 3 },
  review: { label: "Review", bars: 0 },
};

export const BREAKDOWN = {
  intrinsic: {
    label: "Intrinsic",
    token: "var(--load-intrinsic)",
    desc: "How hard the task itself is: errors and uneven typing.",
  },
  extraneous: {
    label: "Extraneous",
    token: "var(--load-extraneous)",
    desc: "Distraction and switching between tabs and windows.",
  },
  germane: {
    label: "Germane",
    token: "var(--load-germane)",
    desc: "Productive effort: the sustained work that builds understanding.",
  },
} as const;

export const SOURCES: Record<SourceKind, { label: string; icon: Icon; desc: string }> = {
  browser: { label: "Browser", icon: Globe, desc: "Tab switches and scrolling. Never page text." },
  vscode: { label: "VS Code", icon: Code, desc: "Compile errors and typing rhythm. Never what you type." },
  desktop: { label: "Desktop agent", icon: Monitor, desc: "Window changes and idle time." },
  lms: { label: "LMS", icon: GraduationCap, desc: "Canvas, Moodle or Blackboard activity." },
};

/** Short names used in compact places (connection pill, popup). */
export const SOURCE_SHORT: Record<SourceKind, string> = {
  browser: "Browser",
  vscode: "VS Code",
  desktop: "Desktop",
  lms: "LMS",
};

export const SOURCE_ORDER: SourceKind[] = ["browser", "vscode", "desktop", "lms"];

/** The engine calls the VS Code plugin "ide". */
export function sourceKindFromDevice(kind: string): SourceKind | null {
  if (kind === "ide" || kind === "vscode") return "vscode";
  if (kind === "browser" || kind === "desktop" || kind === "lms") return kind;
  return null;
}
