'use client';

import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import PopiAvatar from '@/components/PopiAvatar';
import { usePopiVoice } from '@/lib/hooks/usePopiVoice';
import type { MissionStory } from './types';
import { btnIcon, btnPrimary, btnSecondary } from '@/components/challenge/buttons';

/**
 * Popi — the ONE penguin (same character as the Ask-Me mascot), here as the
 * story guide who narrates each chapter.
 */
const POPI_ENTRANCES = ['popi-in-spin', 'popi-in-turn', 'popi-in-fade', 'popi-in-swing', 'popi-in-drop'];

/** Back on the left, the step's next action(s) on the right, on one line at the bottom
 *  of every step (TEMP rule 32). */
export function StepNav({ onBack, backLabel, children }: { onBack: () => void; backLabel: string; children?: ReactNode }) {
  return (
    <div data-testid="step-nav" className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
      <button type="button" onClick={onBack} className={btnSecondary}>
        {backLabel}
      </button>
      <div className="flex flex-wrap items-center justify-end gap-3">{children}</div>
    </div>
  );
}

/** `grand`: the moment Popi starts reading his line, he grows big, then settles back to his
 *  normal size (step 1, TEMP rule 24). `talking` says his line is being read by someone
 *  else's voice (the automatic narration), so he reacts to that too. */
export function Popi({
  text,
  label,
  grand = false,
  talking = false,
}: {
  text: string;
  label?: string;
  grand?: boolean;
  talking?: boolean;
}) {
  const t = useTranslations('story');
  const locale = useLocale();
  const voice = usePopiVoice(locale);
  const speaking = voice.speaking || talking;
  // Each start of speech replays the grow-and-settle (a new key restarts the animation).
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (speaking) setPulse((n) => n + 1);
  }, [speaking]);
  // Each page's Popi arrives with his own move (spin, turn around, fade, swing…), picked
  // from his line so a page always gets the same one and neighbouring pages differ.
  const entrance = POPI_ENTRANCES[[...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % POPI_ENTRANCES.length];
  return (
    <div data-testid="story-popi" className="flex items-end gap-4">
      <span key={text} className={`shrink-0 ${entrance}`}>
        <span key={pulse} className={`block ${grand && pulse > 0 ? 'popi-grand' : ''}`}>
          <PopiAvatar size={120} />
        </span>
      </span>
      <div className="flex flex-1 items-center gap-3 rounded-[22px] bg-white px-5 py-4 shadow-[0_4px_14px_rgba(0,0,0,0.08)] ltr:rounded-bl-[6px] rtl:rounded-br-[6px]">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-body text-sm font-bold text-challenge">
            {label ?? t('popi_says')}
            {speaking && (
              <span aria-hidden="true" className="inline-flex h-3 items-end gap-[2px]">
                {[0, 0.15, 0.3, 0.1, 0.25].map((d, i) => (
                  <span
                    key={i}
                    className="popi-bar block h-3 w-[3px] rounded bg-challenge"
                    style={{ animationDelay: `${d}s` }}
                  />
                ))}
              </span>
            )}
          </p>
          <p className="font-body text-lg font-semibold leading-snug text-ink sm:text-xl">{text}</p>
        </div>
        {voice.available && (
          <button
            type="button"
            data-testid="popi-speak"
            aria-label={voice.speaking ? t('popi_stop') : t('popi_listen')}
            onClick={() => (voice.speaking ? voice.stop() : voice.speak(text))}
            className={btnIcon}
          >
            <span aria-hidden="true">{voice.speaking ? '⏹' : '🔊'}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * One of the app's 3D character renders, alive: an entrance hop, then a slow
 * idle float over a breathing floor shadow. Falls back to the emoji when a
 * character has no render yet.
 */
export function Character3D({
  src,
  emoji,
  alt,
  size = 140,
  className = '',
}: {
  src: string | null;
  emoji: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`story-hop-in relative inline-flex flex-col items-center ${className}`} style={{ width: size }}>
      <span className="story-float block" style={{ width: size, height: size }}>
        {src ? (
          <Image
            src={src}
            alt={alt}
            width={size}
            height={size}
            className="h-full w-full object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.15)]"
          />
        ) : (
          <span
            role="img"
            aria-label={alt}
            className="flex h-full w-full items-center justify-center"
            style={{ fontSize: size * 0.55 }}
          >
            {emoji}
          </span>
        )}
      </span>
      <span aria-hidden="true" className="story-shadow -mt-2 block h-3 w-3/5 rounded-[50%] bg-ink/20" />
    </span>
  );
}

/**
 * The story's stage: the scene backdrop when the mission has one, otherwise a
 * soft pastel sky with drifting bubbles, with the 3D hero standing in front.
 */
export function SceneStage({
  story,
  alt,
  align = 'start',
  priority = false,
}: {
  story: MissionStory;
  alt: string;
  align?: 'start' | 'end';
  priority?: boolean;
}) {
  return (
    <div
      data-testid="story-scene"
      className={`relative flex min-h-[220px] items-end overflow-hidden rounded-card ${
        align === 'end' ? 'justify-end' : 'justify-start'
      } ${story.scene_image ? 'bg-white' : 'bg-gradient-to-b from-tint-blue via-tint-cream to-tint-lime'}`}
    >
      {story.scene_image ? (
        <Image
          src={story.scene_image}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 640px"
          className="object-cover"
          priority={priority}
        />
      ) : (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span className="story-float absolute left-[12%] top-6 block h-16 w-16 rounded-full bg-white/60" />
          <span className="story-float absolute right-[18%] top-10 block h-10 w-10 rounded-full bg-white/50 [animation-delay:1.2s]" />
          <span className="story-float absolute bottom-8 right-[8%] block h-24 w-24 rounded-full bg-white/40 [animation-delay:0.6s]" />
          <span className="absolute bottom-0 left-0 right-0 block h-10 bg-white/40" />
        </span>
      )}
      <Character3D src={story.hero.image} emoji={story.hero.emoji} alt={alt} size={170} className="relative z-10 m-3" />
    </div>
  );
}

/** A burst of confetti over the content card, for the big reward moments. */
export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const [bits, setBits] = useState<{ left: number; delay: number; dur: number; color: string }[]>([]);
  useEffect(() => {
    const colors = ['#1a6fa6', '#f2b705', '#cc3a3a', '#1e7a44', '#c9b3ef', '#5cc7ee'];
    setBits(
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 1.8 + Math.random() * 1.8,
        color: colors[i % colors.length],
      })),
    );
    const id = setTimeout(() => setBits([]), 4500);
    return () => clearTimeout(id);
  }, [pieces]);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {bits.map((b, i) => (
        <i
          key={i}
          className="story-confetti-piece"
          style={{
            left: `${b.left}%`,
            background: b.color,
            animationDuration: `${b.dur}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Small celebratory pill (badge earned, clue unlocked…). */
export function RewardPop({ text }: { text: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      data-testid="story-reward"
      className="story-pop self-center rounded-pill bg-[#fff5d1] px-4 py-2 font-body font-bold text-sm text-[#6b4d00] shadow-sm"
    >
      {text}
    </p>
  );
}

/** Shared button looks, matching the existing mission CTAs. */
export const ctaClass = `${btnPrimary} w-full`;
export const pillCtaClass = `${btnPrimary} self-center`;
export const optionClass = (state: 'idle' | 'right' | 'wrong' | 'picked') =>
  [
    'rounded-2xl border-2 px-4 py-3 font-body text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge',
    state === 'right'
      ? 'border-explore bg-tint-lime text-ink'
      : state === 'wrong'
        ? 'story-shake border-coral bg-tint-blush text-ink'
        : state === 'picked'
          ? 'border-challenge bg-challenge/10 text-ink'
          : 'border-ink/10 bg-white text-ink hover:border-challenge',
  ].join(' ');
export const backClass = `${btnSecondary} self-center`;
