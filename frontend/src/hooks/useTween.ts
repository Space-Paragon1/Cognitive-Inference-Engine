import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./useMediaQuery";

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

/**
 * Tween a 0–1 value the way handoff.md asks: 600 ms ease-out, retarget from the
 * current value when a new tick lands mid-tween, ignore changes under 1 point,
 * and jump straight to the value under reduced motion.
 */
export function useTween(target: number | null, duration = 600, minDelta = 0.01): number | null {
  const reduce = usePrefersReducedMotion();
  const [value, setValue] = useState<number | null>(target);
  const current = useRef<number | null>(target);
  const goal = useRef<number | null>(target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (target == null) {
      if (frame.current) cancelAnimationFrame(frame.current);
      current.current = goal.current = null;
      setValue(null);
      return;
    }
    if (goal.current != null && Math.abs(target - goal.current) < minDelta) return;
    goal.current = target;
    const from = current.current;
    if (from == null || reduce || duration <= 0) {
      if (frame.current) cancelAnimationFrame(frame.current);
      current.current = target;
      setValue(target);
      return;
    }
    if (frame.current) cancelAnimationFrame(frame.current);
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const v = from + (target - from) * easeOut(k);
      current.current = v;
      setValue(v);
      frame.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    frame.current = requestAnimationFrame(step);
  }, [target, duration, minDelta, reduce]);

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  return value;
}
