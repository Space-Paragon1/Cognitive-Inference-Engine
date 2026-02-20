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
