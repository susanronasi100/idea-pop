import { useCallback, useEffect, useState } from 'react';

/** How long a step takes to fade out before the next one replaces it (matches .signup-fade-out). */
export const FADE_OUT_MS = 350;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Holds on to the value on screen while it fades out, then swaps in the new one to fade in.
 * `shown` is what to render; `phase` says which fade class to put on it. With reduced motion
 * the swap is immediate.
 */
export function useFadeSwap<T>(value: T, outMs: number = FADE_OUT_MS) {
  const [shown, setShown] = useState(value);
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  useEffect(() => {
    if (Object.is(value, shown)) return;
    if (prefersReducedMotion()) {
      setShown(value);
      setPhase('in');
      return;
    }
    setPhase('out');
    const id = window.setTimeout(() => {
      setShown(value);
      setPhase('in');
    }, outMs);
    return () => window.clearTimeout(id);
  }, [value, shown, outMs]);

  /** Show a value straight away, with no fade-out first (e.g. when a closed panel opens on a new step). */
  const snap = useCallback((next: T) => {
    setShown(next);
    setPhase('in');
  }, []);

  return { shown, phase, snap, fadeClass: phase === 'out' ? 'signup-fade-out' : 'signup-fade-in' };
}
