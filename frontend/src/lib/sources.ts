/* Which plugins are sending right now, from CognitiveState.sources
   (unix seconds each source was last heard from). */
import type { SourceKind } from "../types/ui";
import { sourceKindFromDevice } from "./domain";

/** A source counts as sending if it was heard from in the last 2 minutes. */
export const SOURCE_FRESH_S = 120;

export function sendingSources(
  sources: Record<string, number> | undefined,
  nowMs = Date.now()
): Partial<Record<SourceKind, boolean>> {
  const out: Partial<Record<SourceKind, boolean>> = {};
  if (!sources) return out;
  for (const [key, at] of Object.entries(sources)) {
    const kind = sourceKindFromDevice(key);
    if (kind && nowMs / 1000 - at <= SOURCE_FRESH_S) out[kind] = true;
  }
  return out;
}

export function countSending(s: Partial<Record<SourceKind, boolean>>) {
  return Object.values(s).filter(Boolean).length;
}

/** "Live · 2 sources" */
export function sourcesLine(n: number) {
  return n === 0 ? "No sources sending" : `${n} source${n === 1 ? "" : "s"}`;
}
