'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { planNarration } from '@/lib/narration';

/**
 * Popi's voice: reads a line aloud with the browser's own speech, in the page's
 * language. `available` is false when this browser has no voice for that language
 * (often the case for Persian), so the speaker button can stay hidden.
 */
export function usePopiVoice(locale: string) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [available, setAvailable] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // Each call to speak() gets a new run id; a phrase only goes on if its run is still current,
  // so Stop, a new line, or leaving the page ends the old one cleanly.
  const run = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const pick = () => {
      const lang = locale.toLowerCase();
      const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
      // Prefer the most human-sounding voices: Edge's "Natural"/"Online" voices, then
      // Google's, then any other voice for the language.
      const rank = (v: SpeechSynthesisVoice) => {
        // Neural voices first (Edge "Natural"/"Online", then Google's), then voices known to
        // sound warm for storytelling, then anything else for the language.
        const n = v.name;
        const tier = /natural/i.test(n) ? 0 : /online/i.test(n) ? 1 : /google/i.test(n) ? 2 : 3;
        const warm = /(aria|jenny|ana|sonia|libby|zira|samantha|female|dilara|farid)/i.test(n) ? 0 : 0.5;
        return tier + warm;
      };
      const chosen = [...voices].sort((a, b) => rank(a) - rank(b))[0] ?? null;
      setVoice(chosen);
      setAvailable(!!chosen);
    };
    pick();
    synth.addEventListener('voiceschanged', pick);
    return () => {
      synth.removeEventListener('voiceschanged', pick);
      run.current += 1;
      synth.cancel();
    };
  }, [locale]);

  const stop = useCallback(() => {
    run.current += 1;
    if (timer.current) window.clearTimeout(timer.current);
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  /** Tells the line as a storyteller would: phrase by phrase, with breaths between them. */
  const speak = useCallback(
    (text: string) => {
      if (!voice) return;
      stop();
      const id = run.current;
      const phrases = planNarration(text);
      const synth = window.speechSynthesis;
      setSpeaking(true);
      const say = (i: number) => {
        if (run.current !== id) return;
        if (i >= phrases.length) {
          setSpeaking(false);
          return;
        }
        const p = phrases[i];
        const u = new SpeechSynthesisUtterance(p.text);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = p.rate;
        u.pitch = p.pitch;
        u.onend = () => {
          if (run.current !== id) return;
          timer.current = window.setTimeout(() => say(i + 1), p.pauseAfter);
        };
        u.onerror = () => run.current === id && setSpeaking(false);
        synth.speak(u);
      };
      say(0);
    },
    [voice, stop],
  );

  return { available, speaking, speak, stop };
}
