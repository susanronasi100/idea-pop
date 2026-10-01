'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Popi's voice: reads a line aloud with the browser's own speech, in the page's
 * language. `available` is false when this browser has no voice for that language
 * (often the case for Persian), so the speaker button can stay hidden.
 */
export function usePopiVoice(locale: string) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [available, setAvailable] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const pick = () => {
      const lang = locale.toLowerCase();
      const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
      const chosen = voices.find((v) => v.localService) ?? voices[0] ?? null;
      setVoice(chosen);
      setAvailable(!!chosen);
    };
    pick();
    synth.addEventListener('voiceschanged', pick);
    return () => {
      synth.removeEventListener('voiceschanged', pick);
      synth.cancel();
    };
  }, [locale]);

  const speak = useCallback(
    (text: string) => {
      if (!voice) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.95;
      u.pitch = 1.15;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      synth.speak(u);
    },
    [voice],
  );

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { available, speaking, speak, stop };
}
