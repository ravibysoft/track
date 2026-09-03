import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

/* Fast at the start, gently settling — the same feel as the CSS ease-out curve. */
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/**
 * Counts from 0 up to `value` on mount, and animates between values afterwards.
 *
 * Deliberately a leaf-level hook: only the component showing the number re-renders
 * each frame, so a 500ms count never re-renders a whole screen 30 times.
 *
 * Under reduced motion the state simply *starts* at the target, so there is no
 * tween to run and nothing to set.
 */
export default function useCountUp(value, duration = 520) {
  const reduced = prefersReducedMotion();
  const [display, setDisplay] = useState(() => (reduced ? value : 0));
  const from = useRef(reduced ? value : 0);
  const frame = useRef(0);

  useEffect(() => {
    const start = from.current;
    const delta = value - start;
    if (delta === 0) return undefined;

    if (reduced) {
      from.current = value;
      frame.current = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(frame.current);
    }

    const began = performance.now();
    /* Reads the clock itself rather than trusting the timestamp rAF passes in —
       that argument's origin is not guaranteed to match performance.now(). */
    const tick = () => {
      const t = Math.min((performance.now() - began) / duration, 1);
      setDisplay(start + delta * easeOutCubic(t));
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        from.current = value;
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration, reduced]);

  return display;
}
