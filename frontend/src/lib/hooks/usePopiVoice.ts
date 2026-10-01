'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { planNarration } from '@/lib/narration';

/** Recorded lines (ElevenLabs, made by scripts/generate-popi-voice.mjs): lang → exact line → file. */
type Manifest = Record<string, Record<string, string>>;
let manifestPromise: Promise<Manifest> | null = null;
function loadManifest(): Promise<Manifest> {
  manifestPromise ??= fetch('/audio/popi/manifest.json')
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : {}))
    .catch(() => ({}));
  return manifestPromise;
}

/**
 * Popi's voice. A line that has a recorded file (a voice-actor read made with ElevenLabs)
 * plays that file; any other line is told by the browser's own speech, phrase by phrase
 * like a storyteller. `available` is false only when neither exists for the page's
 * language, so the speaker button can stay hidden.
 */
export function usePopiVoice(locale: string) {
  const lang = locale.toLowerCase().split('-')[0];
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [recorded, setRecorded] = useState<Record<string, string>>({});
  const [speaking, setSpeaking] = useState(false);
  // Each call to speak() gets a new run id; a phrase only goes on if its run is still current,
  // so Stop, a new line, or leaving the page ends the old one cleanly.
  const run = useRef(0);
  const timer = useRef<number | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let alive = true;
    loadManifest().then((m) => alive && setRecorded(m[lang] ?? {}));
    return () => {
      alive = false;
    };
  }, [lang]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const pick = () => {
      const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
      // Neural voices first (Edge "Natural"/"Online", then Google's), then voices known to
      // sound warm for storytelling, then anything else for the language.
      const rank = (v: SpeechSynthesisVoice) => {
        const n = v.name;
        const tier = /natural/i.test(n) ? 0 : /online/i.test(n) ? 1 : /google/i.test(n) ? 2 : 3;
        const warm = /(aria|jenny|ana|sonia|libby|zira|samantha|female|dilara|farid)/i.test(n) ? 0 : 0.5;
        return tier + warm;
      };
      setVoice([...voices].sort((a, b) => rank(a) - rank(b))[0] ?? null);
    };
    pick();
    synth.addEventListener('voiceschanged', pick);
    return () => {
      synth.removeEventListener('voiceschanged', pick);
      run.current += 1;
      synth.cancel();
      audio.current?.pause();
    };
  }, [lang]);

  const stop = useCallback(() => {
    run.current += 1;
    if (timer.current) window.clearTimeout(timer.current);
    window.speechSynthesis?.cancel();
    audio.current?.pause();
    setSpeaking(false);
  }, []);

  /** Plays the recorded read when there is one; otherwise tells the line phrase by phrase. */
  const speak = useCallback(
    (text: string) => {
      const file = recorded[text.trim()];
      if (!file && !voice) return;
      stop();
      const id = run.current;
      setSpeaking(true);

      if (file) {
        const a = new Audio(`/audio/popi/${file}`);
        audio.current = a;
        a.onended = () => run.current === id && setSpeaking(false);
        a.onerror = () => run.current === id && setSpeaking(false);
        a.play().catch(() => run.current === id && setSpeaking(false));
        return;
      }

      const phrases = planNarration(text);
      const synth = window.speechSynthesis;
      const say = (i: number) => {
        if (run.current !== id) return;
        if (i >= phrases.length || !voice) {
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
    [voice, recorded, stop],
  );

  const available = !!voice || Object.keys(recorded).length > 0;
  return { available, speaking, speak, stop };
}
