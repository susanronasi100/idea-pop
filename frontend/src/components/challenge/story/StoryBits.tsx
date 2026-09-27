'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MissionStory } from './types';

/**
 * Popi — the ONE penguin (same character as the Ask-Me mascot), here as the
 * story guide who narrates each chapter.
 */
export function Popi({ text, label }: { text: string; label?: string }) {
  const t = useTranslations('story');
  return (
    <div data-testid="story-popi" className="flex items-end gap-3">
      <span
        aria-hidden="true"
        className="story-bob flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-challenge text-3xl shadow-[0_4px_10px_rgba(26,111,166,0.3)]"
      >
        🐧
      </span>
      <div className="rounded-[18px] bg-white px-4 py-3 shadow-sm ltr:rounded-bl-[4px] rtl:rounded-br-[4px]">
        <p className="font-display text-xs text-challenge">{label ?? t('popi_says')}</p>
        <p className="font-body text-sm font-medium text-ink sm:text-base">{text}</p>
      </div>
    </div>
  );
}

/** The chapter banner: chapter label + Story Spine beat, title, one line of
 *  story, and a book spine that fills as the chapters are read. */
export function ChapterBanner({
  story,
  step,
}: {
  story: MissionStory;
  step: string;
}) {
  const index = story.chapters.findIndex((c) => c.step === step);
  const chapter = story.chapters[index];
  if (!chapter) return null;
  return (
    <div
      data-testid="chapter-banner"
      className="story-rise flex items-center gap-3 rounded-card bg-white px-4 py-3 shadow-[inset_0_-4px_0_rgba(26,111,166,0.12)]"
    >
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tint-cream text-2xl">
        📖
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-body text-[11px] font-bold uppercase tracking-wider text-ink/60">
          {chapter.label} · {chapter.beat}
        </p>
        <p className="font-display text-lg text-challenge">{chapter.title}</p>
        <p className="font-body text-sm text-ink">{chapter.line}</p>
      </div>
      <span aria-hidden="true" className="hidden gap-[3px] sm:flex">
        {story.chapters.map((c, i) => (
          <span
            key={c.step}
            className={`block h-[22px] w-2 rounded-[3px] ${i <= index ? 'bg-challenge' : 'bg-ink/10'}`}
          />
        ))}
      </span>
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
    <span
      className={`story-hop-in relative inline-flex flex-col items-center ${className}`}
      style={{ width: size }}
    >
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
          <span role="img" aria-label={alt} className="flex h-full w-full items-center justify-center" style={{ fontSize: size * 0.55 }}>
            {emoji}
          </span>
        )}
      </span>
      <span aria-hidden="true" className="story-shadow -mt-2 block h-3 w-3/5 rounded-[50%] bg-ink/20" />
    </span>
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
          style={{ left: `${b.left}%`, background: b.color, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}
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
      className="story-pop self-center rounded-pill bg-[#fff5d1] px-4 py-2 font-display text-sm text-[#6b4d00] shadow-sm"
    >
      {text}
    </p>
  );
}

/** Shared button looks, matching the existing mission CTAs. */
export const ctaClass =
  'w-full rounded-card bg-challenge px-8 py-4 font-display text-lg text-white transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2';
export const pillCtaClass =
  'self-center rounded-pill bg-challenge px-6 py-3 font-body text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2';
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
export const backClass = 'self-center font-body text-sm text-ink/50 transition-colors hover:text-ink';
