/* Replay transport: one step is one tick (2 s of the session). At 1× a step takes
   2 s, so the session replays in real time; 2×, 5× and 10× go faster.
   The playhead is kept as a time, so a running session can grow under it, and it is
   remembered per session for the visit (the phone's event log seeks, then goes back). */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlaybackControlsProps, PlaybackSpeed } from "../../types/ui";
import { tickAt } from "../../lib/history";
import type { ReplayTick } from "../../lib/history";
import { onAccountReset } from "../../lib/accountReset";

const SPEED_KEY = "clr_replay_speed";
const remembered = new Map<number, number>();
onAccountReset(() => remembered.clear());

/** Put the playhead of `session` at unix time `t` before its replay opens. */
export function rememberReplayTime(session: number, t: number) {
  remembered.set(session, t);
}

function readSpeed(): PlaybackSpeed {
  try {
    const v = Number(localStorage.getItem(SPEED_KEY));
    return v === 2 || v === 5 || v === 10 ? v : 1;
  } catch {
    return 1;
  }
}

export interface Replay {
  /** Index of the tick under the playhead. */
  index: number;
  tick: ReplayTick | null;
  controls: PlaybackControlsProps;
  /** Move the playhead to a unix time (seconds), e.g. from an event-log row. */
  seekTime: (t: number) => void;
}

/** `session` (its start time) keys the playhead; changing it pauses. */
export function useReplay(ticks: ReplayTick[], session: number | null): Replay {
  const [time, setTime] = useState<number | null>(() => (session != null ? remembered.get(session) ?? null : null));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(readSpeed);
  const ticksRef = useRef(ticks);
  ticksRef.current = ticks;

  const last = Math.max(0, ticks.length - 1);
  const start = ticks[0]?.t ?? 0;
  const index = ticks.length ? (time == null ? 0 : tickAt(ticks, time)) : 0;

  useEffect(() => {
    setTime(session != null ? remembered.get(session) ?? null : null);
    setPlaying(false);
  }, [session]);

  useEffect(() => {
    if (session != null && time != null) remembered.set(session, time);
  }, [session, time]);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => {
      const ks = ticksRef.current;
      if (!ks.length) return;
      setTime((prev) => ks[Math.min(ks.length - 1, (prev == null ? 0 : tickAt(ks, prev)) + 1)].t);
    }, 2000 / speed);
    return () => window.clearInterval(t);
  }, [playing, speed]);

  // Stop at the end rather than loop.
  useEffect(() => {
    if (playing && index >= last) setPlaying(false);
  }, [playing, index, last]);

  const to = useCallback((i: number) => {
    const ks = ticksRef.current;
    if (ks.length) setTime(ks[Math.max(0, Math.min(ks.length - 1, i))].t);
  }, []);

  const onPlayPause = useCallback(() => {
    if (!ticks.length) return;
    if (!playing && index >= last) to(0);
    setPlaying(!playing);
  }, [ticks.length, playing, index, last, to]);

  const setSpeed = useCallback((s: PlaybackSpeed) => {
    setSpeedState(s);
    try {
      localStorage.setItem(SPEED_KEY, String(s));
    } catch {
      /* storage blocked */
    }
  }, []);

  const position = ticks.length ? ticks[index].t - start : 0;
  const duration = ticks.length ? ticks[last].t - start : 0;

  const controls = useMemo<PlaybackControlsProps>(
    () => ({
      playing,
      position,
      duration,
      speed,
      onPlayPause,
      onStep: (d) => to(index + d),
      onJump: (where) => to(where === "start" ? 0 : last),
      onSeek: (s) => to(tickAt(ticksRef.current, start + s)),
      onSpeed: setSpeed,
    }),
    [playing, position, duration, speed, onPlayPause, to, index, last, start, setSpeed]
  );

  const seekTime = useCallback((t: number) => to(tickAt(ticksRef.current, t)), [to]);

  return { index, tick: ticks[index] ?? null, controls, seekTime };
}
