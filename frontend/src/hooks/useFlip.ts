import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { usePrefersReducedMotion } from "./useMediaQuery";

/**
 * FLIP for list reorders: children marked with data-flip-key slide from their old
 * position to the new one (400 ms ease-in-out). Positions are measured relative to
 * the container, so scrolling between renders doesn't cause false moves.
 * Under reduced motion items swap instantly.
 */
export function useFlip(container: RefObject<HTMLElement>, key: unknown, duration = 400) {
  const reduce = usePrefersReducedMotion();
  const rects = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const next = new Map<string, DOMRect>();
    root.querySelectorAll<HTMLElement>("[data-flip-key]").forEach((el) => {
      const r = el.getBoundingClientRect();
      const rel = new DOMRect(r.left - base.left, r.top - base.top, r.width, r.height);
      const k = el.dataset.flipKey!;
      next.set(k, rel);
      const prev = rects.current.get(k);
      if (!prev || reduce || typeof el.animate !== "function") return;
      const dx = prev.left - rel.left;
      const dy = prev.top - rel.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
        duration,
        easing: "cubic-bezier(0.65, 0, 0.35, 1)",
      });
    });
    rects.current = next;
  }, [container, key, duration, reduce]);
}
