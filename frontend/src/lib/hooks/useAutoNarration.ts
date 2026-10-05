'use client';

import { useEffect, useRef, useState } from 'react';
import type { usePopiVoice } from './usePopiVoice';

/** How long Popi waits before he starts reading, and again before his own message. */
export const AUTO_WAIT_MS = 5000;
/** A short breath between one page and the next. */
const TURN_MS = 600;

type Voice = ReturnType<typeof usePopiVoice>;
export type AutoPhase = 'wait' | 'pages' | 'finale' | 'blocked' | 'off';

// Popi reads a challenge's opening once per visit, not every time the child comes back to step 1.
const narrated = new Set<string>();

/**
 * TEMP rule 19: when a challenge opens, Popi waits, reads the opening pages one after
 * another (turning the page himself), waits again, then reads his own message. Any tap or
 * key press by the child stops it. If the browser blocks sound until the first tap, that
 * tap starts the reading instead.
 */
export function useAutoNarration({
  id,
  enabled = true,
  voice,
  pages,
  onTurn,
  finale,
  onFinale,
}: {
  /** One run per challenge per visit. */
  id: string;
  enabled?: boolean;
  voice: Voice;
  /** The words of each opening page, in order. */
  pages: string[];
  /** Shows page i (for a picture book that turns its own pages). */
  onTurn?: (i: number) => void;
  /** Popi's message, read after the last page and a second wait. */
  finale?: string | null;
  /** Called just before the message is read, e.g. to bring Popi into view. */
  onFinale?: () => void;
}) {
  const [phase, setPhase] = useState<AutoPhase>(() => (enabled && !narrated.has(id) ? 'wait' : 'off'));
  const [pos, setPos] = useState(0);
  const resume = useRef<AutoPhase>('pages');
  // Callbacks change identity on every render; the timers always use the latest ones.
  const latest = useRef({ voice, onTurn, onFinale, pages, finale });
  latest.current = { voice, onTurn, onFinale, pages, finale };

  useEffect(() => {
    if (phase !== 'off') narrated.add(id);
  }, [id, phase]);

  // 1. The first wait.
  useEffect(() => {
    if (phase !== 'wait' || !voice.available) return;
    const t = window.setTimeout(() => setPhase('pages'), AUTO_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [phase, voice.available]);

  // 2. Each page in turn; when one ends, the next one is shown and read.
  useEffect(() => {
    if (phase !== 'pages') return;
    const i = pos;
    const t = window.setTimeout(() => {
      const { voice: v, pages: all } = latest.current;
      v.speak(all[i] ?? '', {
        onEnd: () => {
          if (i < latest.current.pages.length - 1) {
            latest.current.onTurn?.(i + 1);
            setPos(i + 1);
          } else {
            setPhase(latest.current.finale ? 'finale' : 'off');
          }
        },
        onBlocked: () => {
          resume.current = 'pages';
          setPhase('blocked');
        },
      });
    }, TURN_MS);
    return () => window.clearTimeout(t);
  }, [phase, pos]);

  // 3. The second wait, then Popi's own message.
  useEffect(() => {
    if (phase !== 'finale') return;
    const t = window.setTimeout(() => {
      const { voice: v, finale: text, onFinale: show } = latest.current;
      if (!text) return setPhase('off');
      show?.();
      v.speak(text, {
        onEnd: () => setPhase('off'),
        onBlocked: () => {
          resume.current = 'finale';
          setPhase('blocked');
        },
      });
    }, AUTO_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // A tap stops the reading, or starts it when the browser was waiting for one.
  useEffect(() => {
    if (phase === 'off') return;
    const onTap = () => {
      if (phase === 'blocked') {
        setPhase(resume.current);
        return;
      }
      // Before Popi starts, a tap (scrolling, focusing the window) only unlocks sound for him.
      if (phase === 'wait') return;
      latest.current.voice.stop();
      setPhase('off');
    };
    window.addEventListener('pointerdown', onTap, true);
    window.addEventListener('keydown', onTap, true);
    return () => {
      window.removeEventListener('pointerdown', onTap, true);
      window.removeEventListener('keydown', onTap, true);
    };
  }, [phase]);

  return { phase, reading: phase === 'pages' ? pos : null };
}
