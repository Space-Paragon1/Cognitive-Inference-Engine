export interface LoadBreakdown {
  intrinsic: number;
  extraneous: number;
  germane: number;
}

export type CognitiveContext =
  | "deep_focus"
  | "shallow_work"
  | "stuck"
  | "fatigue"
  | "recovering"
  | "unknown";

export interface CognitiveState {
  load_score: number;
  context: CognitiveContext;
  confidence: number;
  breakdown: LoadBreakdown;
  timestamp: number;
}

export interface TimelineEntry {
  id: number | null;
  timestamp: number;
  source: string;
  event_type: string;
  load_score: number;
  context: string;
  metadata_json: string;
}

export interface Task {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard" | "review";
  estimated_minutes: number;
  tags: string[];
}

export interface TaskQueue {
  tasks: Task[];
  recommended_duration_minutes: number;
}

export interface FocusState {
  active: boolean;
  elapsed_minutes: number;
  duration_minutes: number;
  block_tabs: boolean;
  reason: string;
}

export interface PomodoroState {
  phase: "work" | "short_break" | "long_break" | "idle";
  elapsed_seconds: number;
  remaining_seconds: number;
  sessions_completed: number;
  duration_seconds: number;
}

export interface SessionSummary {
  session_index: number;
  start_ts: number;
  end_ts: number;
  duration_minutes: number;
  tick_count: number;
  avg_load_score: number;
  peak_load_score: number;
  context_distribution: Record<string, number>;
  dominant_context: string;
}

export interface Settings {
  short_break_seconds: number;
  long_break_seconds: number;
  high_load_threshold: number;
  fatigue_threshold: number;
  session_gap_minutes: number;
}

export interface SettingsResponse {
  settings: Settings;
  defaults: Settings;
}

export interface DailyStats {
  date: string;
  tick_count: number;
  session_count: number;
  avg_load_score: number;
  peak_load_score: number;
  total_session_minutes: number;
  focus_minutes: number;
  context_distribution: Record<string, number>;
}
