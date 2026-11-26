/**
 * Cognitive Load Router — component contracts for the React 18 + TypeScript app.
 *
 * The previews in this system are vanilla renderers (window.CLR.*) so they run
 * without a build step. These interfaces are what the React components in
 * frontend/src/components should accept. Domain types mirror
 * frontend/src/types/index.ts; values are 0–1 fractions unless noted.
 * Icons are lucide-react components.
 */

import type { ReactNode, ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Domain                                                             */
/* ------------------------------------------------------------------ */

export type CognitiveContext =
  | 'deep_focus'
  | 'shallow_work'
  | 'stuck'
  | 'fatigue'
  | 'recovering'
  | 'unknown';

export type DirectiveType =
  | 'recommend_break'
  | 'suppress_notifications'
  | 'block_distracting_tabs'
  | 'suggest_task'
  | 'shorten_focus_interval'
  | 'delay_hard_tasks'
  | 'schedule_hard_task'
  | 'allow_notifications';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'review';
export type PomodoroPhase = 'idle' | 'work' | 'short_break' | 'long_break';
export type ConnectionState = 'live' | 'reconnecting' | 'offline';
export type SourceKind = 'browser' | 'vscode' | 'desktop' | 'lms';
export type SourceState = 'not_connected' | 'waiting' | 'connected';
export type Tone = 'accent' | 'positive' | 'caution' | 'critical' | 'rest' | 'neutral';

export interface LoadBreakdown {
  /** How hard the task itself is (errors, typing variance). 0–1. */
  intrinsic: number;
  /** Distraction and switching (tab and window churn). 0–1. */
  extraneous: number;
  /** Productive effort (sustained engagement). 0–1. */
  germane: number;
}

export type Icon = ComponentType<LucideProps>;

/* ------------------------------------------------------------------ */
/* Live state                                                          */
/* ------------------------------------------------------------------ */

export interface LoadGaugeProps {
  /** 0–1. Tweened over --dur-gauge (600ms) on every change. null = no data yet. */
  load: number | null;
  context: CognitiveContext;
  /** 0–1. Below 0.5 the arc turns dotted, the number gets a ≈ prefix and the pill is outlined. */
  confidence: number;
  /** Rendered size in px. 280 desktop hero, 220 mobile hero, 84 popup, 40 sidebar mini, 28 top-bar pill. Default 280. */
  size?: number;
  /** Tick marks on the arc. Default { high: 0.70, fatigue: 0.85 } from Settings. */
  thresholds?: { high: number; fatigue: number };
  /** Line under the number. Default "load". */
  caption?: string;
  /** 'hero' shows number, caption and pill; 'mini' is ring + number only; 'pill' is the top-bar chip. */
  variant?: 'hero' | 'mini' | 'pill';
}

export interface ContextPillProps {
  context: CognitiveContext;
  /** Override the label. Default is the exact domain label ("Deep focus", "Warming up"…). */
  label?: string;
  size?: 'sm' | 'md';
  /** Outlined, dashed border. Use when confidence < 0.5. */
  uncertain?: boolean;
  /** Text-only, no fill (inside tables and dense lists). */
  plain?: boolean;
}

export interface BreakdownProps extends LoadBreakdown {
  /** Hide the one-line explanations (extension popup, sidebar). */
  compact?: boolean;
  /** Show the "Rough" badge and dim the bars when confidence < 0.5. */
  uncertain?: boolean;
}

export interface ConnectionStatusProps {
  status: ConnectionState;
  /** Sources currently sending. Unlisted sources render as not connected. */
  sources?: Partial<Record<SourceKind, boolean>>;
  /** Seconds since the last tick, shown when reconnecting or offline. */
  lastSeenSeconds?: number;
}

/* ------------------------------------------------------------------ */
/* Data display                                                        */
/* ------------------------------------------------------------------ */

/** StatsCard in the codebase. */
export interface StatTileProps {
  label: string;
  /** Pre-formatted number, e.g. "12.3" or "1 h 48". Rendered in tabular numerals. */
  value: string;
  unit?: string;
  icon?: Icon;
  /** Secondary line, e.g. "1.4 h more than last week". */
  sub?: string;
  /** Direction only; never coloured red/green. */
  trend?: 'up' | 'down' | 'flat';
  /** No card chrome (inside another card). */
  plain?: boolean;
}

export interface ContextBarProps {
  /** Share of time per context, 0–1, summing to ~1. Segments render in the fixed CTX order. */
  distribution: Partial<Record<CognitiveContext, number>>;
  legend?: boolean;
}

/**
 * Recharts styling recipe. Not a component: these are the props every chart
 * passes to Recharts primitives. See components/ChartStyle/README.md.
 */
export interface ChartStyleProps {
  kind: 'live-load' | 'replay' | 'daily-bars' | 'context-mix' | 'heatmap';
  /** 'sm' 160px tall (mobile), 'md' 220px, 'lg' 280px. */
  height?: 'sm' | 'md' | 'lg';
  /** Screen-reader summary, e.g. "Load over the last 5 minutes, now 62 percent, peak 71". */
  ariaLabel: string;
}

/* ------------------------------------------------------------------ */
/* Coaching                                                            */
/* ------------------------------------------------------------------ */

/** One item in DirectivesFeed. Maps from ActionDirective. */
export interface DirectiveCardProps {
  type: DirectiveType;
  /** Plain-English reason, written as what CLR is doing for you. */
  reason: string;
  /** Override the label (defaults to the exact domain label). */
  label?: string;
  /** e.g. "Since 9:42 pm" or "3 sites · since 9:42 pm". */
  meta?: string;
  /** Optional single action ("Pause", "Edit", "Start break"). */
  action?: { label: string; onClick: () => void };
  /** Arrived in the last tick: fades in and gets a 4s soft highlight. */
  isNew?: boolean;
}

export interface DirectivesFeedProps {
  /** Sorted by priority ascending (1 first). Empty = "All clear". */
  directives: DirectiveCardProps[];
  /** No card chrome (mobile, where the feed sits on the page). */
  bare?: boolean;
}

export interface ToastProps {
  title: string;
  body?: string;
  icon?: Icon;
  /** Colours the icon tile with a context's soft fill. */
  context?: CognitiveContext;
  tone?: Tone;
  actions?: { label: string; onClick: () => void; primary?: boolean }[];
  /** ms before auto-dismiss. Default 6000; overload and break prompts stay until acted on (pass null). */
  duration?: number | null;
  onClose?: () => void;
}

export interface BannerProps {
  title: string;
  body?: string;
  icon?: Icon;
  tone?: Tone;
  context?: CognitiveContext;
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

/** One row in TaskQueue. Maps from Task. */
export interface TaskRowProps {
  id: string;
  title: string;
  difficulty: Difficulty;
  minutes: number;
  tags?: string[];
  /** The task CLR recommends now. At most one per list. */
  recommended?: boolean;
  /** Places moved in the last reorder (+ up, − down). Shows an arrow chip for 4s. */
  moved?: number;
  done?: boolean;
  onToggleDone?: (id: string) => void;
  onStart?: (id: string) => void;
  onMenu?: (id: string) => void;
}

export interface DifficultyChipProps {
  level: Difficulty;
  size?: 'sm' | 'md';
}

/* ------------------------------------------------------------------ */
/* Focus and timer (ControlPanel)                                      */
/* ------------------------------------------------------------------ */

export interface TimerProps {
  phase: PomodoroPhase;
  remainingSeconds: number;
  totalSeconds: number;
  /** Completed focus sessions in the current set of 4. */
  sessionsCompleted: number;
  /** Load at the moment the length was chosen, 0–1. Drives the "why this length" line. */
  loadAtStart?: number;
  /** Override the why line, e.g. "15 min because your load is high (78%)." */
  why?: string;
  size?: number;
  onStart?: () => void;
  onPause?: () => void;
  onSkip?: () => void;
  onStop?: () => void;
}

export interface MiniPlayerProps {
  phase: PomodoroPhase | 'focus_mode';
  remainingSeconds: number;
  totalSeconds: number;
  label?: string;
  onToggle?: () => void;
  onExpand?: () => void;
}

/* ------------------------------------------------------------------ */
/* History (TimelineReplay)                                            */
/* ------------------------------------------------------------------ */

export type PlaybackSpeed = 1 | 2 | 5 | 10;

export interface PlaybackControlsProps {
  playing: boolean;
  /** Seconds from session start. */
  position: number;
  duration: number;
  speed: PlaybackSpeed;
  onPlayPause: () => void;
  onStep: (direction: -1 | 1) => void;
  onJump: (to: 'start' | 'end') => void;
  onSeek: (seconds: number) => void;
  onSpeed: (speed: PlaybackSpeed) => void;
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

export interface ButtonProps {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'rest';
  /** sm 36px (44px hit area), md 44px, lg 52px. Default md. */
  size?: 'sm' | 'md' | 'lg';
  icon?: Icon;
  iconRight?: Icon;
  /** Square, label goes to aria-label. */
  iconOnly?: boolean;
  /** Full width. */
  block?: boolean;
  loading?: boolean;
  /** Replaces the label while loading, e.g. "Signing in…". */
  loadingLabel?: string;
  disabled?: boolean;
  /** For toggling buttons such as Do Not Disturb. */
  pressed?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  'aria-label'?: string;
}

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password' | 'number';
  placeholder?: string;
  icon?: Icon;
  /** Shown under the field, announced with role="alert". Replaces help. */
  error?: string;
  /** Green check plus a confirming help line ("Passwords match.") for live validation. */
  valid?: boolean;
  help?: string;
  /** Link beside the label, e.g. "Forgot password?". */
  aside?: ReactNode;
  textarea?: boolean;
  autoComplete?: string;
}

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Required: used as the accessible name even when visually hidden. */
  label: string;
  /** Second line in the row layout. */
  description?: string;
  /** Full-width row with label on the left (Settings). */
  row?: boolean;
  disabled?: boolean;
}

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  /** Default value: drawn as a tick, and "Reset to default" appears when value differs. */
  defaultValue: number;
  /** Values below this are hatched and unreachable (fatigue must exceed high load). */
  blockBelow?: number;
  help?: string;
  onChange: (value: number) => void;
  onReset?: () => void;
}

export interface SegmentedControlProps<T extends string = string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** aria-label for the radiogroup. */
  label: string;
  size?: 'sm' | 'md';
}

export interface FilterChipProps {
  label: string;
  context?: CognitiveContext;
  selected: boolean;
  count?: number;
  onToggle: () => void;
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export type Route = 'now' | 'focus' | 'tasks' | 'history' | 'insights' | 'settings' | 'more';

export interface TabBarProps {
  active: Exclude<Route, 'history' | 'settings'>;
  onNavigate: (route: Route) => void;
}

export interface SidebarProps {
  active: Exclude<Route, 'more'>;
  load: number | null;
  context: CognitiveContext;
  confidence: number;
  status: ConnectionState;
  /** Running timer, shown as a compact row above the account. */
  timer?: Pick<MiniPlayerProps, 'phase' | 'remainingSeconds' | 'totalSeconds'>;
  /** 72px icon rail at 1024–1279px. */
  collapsed?: boolean;
  onNavigate: (route: Route) => void;
}

export interface BottomSheetProps {
  open: boolean;
  title: string;
  children: ReactNode;
  /** Footer buttons; the primary one goes last (right / bottom). */
  actions?: ReactNode;
  /** At ≥768px the sheet renders as a centred dialog. */
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: Icon;
  tone?: Tone;
  context?: CognitiveContext;
  actions?: ReactNode;
  /** Less padding, for empty cards inside a grid. */
  compact?: boolean;
}

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: 'xs' | 'sm' | 'md' | 'lg' | 'full';
  /** Shapes that mirror the real layout: pass the component you are standing in for. */
  shape?: 'text' | 'gauge' | 'tile' | 'row' | 'chart';
}

/* ------------------------------------------------------------------ */
/* Onboarding                                                          */
/* ------------------------------------------------------------------ */

export interface SourceCardProps {
  kind: SourceKind;
  state: SourceState;
  /** Pairing code while waiting, e.g. "H2M-9PX". */
  code?: string;
  /** Seconds the code stays valid. */
  codeExpiresIn?: number;
  /** "12s ago". */
  lastSeen?: string;
  recommended?: boolean;
  optional?: boolean;
  onConnect?: () => void;
  onCancel?: () => void;
  onDisconnect?: () => void;
}
