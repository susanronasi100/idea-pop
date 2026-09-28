'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import XpInfoDialog from './XpInfoDialog';

const ALL_STEPS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const INFO_KEYS = ['problem', 'goal', 'rules'] as const;

/** The mission's key facts, shown under the title on every step. */
export interface MissionKeyInfo {
  problem: string;
  goal: string;
  rules: string;
}

interface MissionHUDProps {
  challenge: { title: string; emoji: string; completion_xp: number };
  currentStep: number; // 1-8
  reachedSteps: Set<number>;
  onJumpTo: (step: number) => void;
  ideaPath?: 'yes' | 'no' | null;
  /** Problem / Goal / Rules pinned under the title (story missions). */
  keyInfo?: MissionKeyInfo | null;
  /** Fallback one-line problem statement when there is no story card. */
  summary?: string | null;
}

export default function MissionHUD({
  challenge,
  currentStep,
  reachedSteps,
  onJumpTo,
  keyInfo = null,
  summary = null,
}: MissionHUDProps) {
  const t = useTranslations('challenge');
  const tStory = useTranslations('story');
  const [menuOpen, setMenuOpen] = useState(false);
  const [xpOpen, setXpOpen] = useState(false);

  function handleStepClick(step: number) {
    if (reachedSteps.has(step)) {
      onJumpTo(step);
      setMenuOpen(false);
    }
  }

  return (
    <div data-testid="mission-hud" className="relative z-40">
      {/* Title bar */}
      <div className="flex items-center gap-2 bg-white px-4 py-3 shadow-sm">
        {/* Left: menu toggle */}
        <button
          data-testid="mission-menu-button"
          aria-label={t('hud_menu_aria')}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-tint-blue transition-colors"
        >
          <span className="text-lg leading-none">☰</span>
        </button>

        {/* Center: title */}
        <p className="min-w-0 flex-1 truncate text-center font-display text-sm text-ink">
          {challenge.emoji} {challenge.title}
        </p>

        {/* Right: XP badge — a button that explains XP. dir=ltr so "+N XP"
            doesn't reorder in RTL. */}
        <button
          type="button"
          dir="ltr"
          data-testid="hud-xp-button"
          aria-haspopup="dialog"
          aria-label={t('hud_xp_aria', { xp: challenge.completion_xp })}
          onClick={() => setXpOpen(true)}
          className="flex shrink-0 items-center gap-1 rounded-pill bg-challenge px-3 py-1.5 font-body text-xs font-semibold text-white shadow-sm transition-transform hover:scale-105 hover:bg-challenge/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2"
        >
          <span aria-hidden="true">⭐</span>
          {t('hud_xp', { xp: challenge.completion_xp })}
          <span
            aria-hidden="true"
            className="flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[10px] leading-none"
          >
            ?
          </span>
        </button>
      </div>

      {/* Key info: the problem statement and constraints on every step */}
      {keyInfo ? (
        <dl
          data-testid="mission-key-info"
          className="grid grid-cols-3 gap-2 border-t border-ink/5 bg-white px-4 py-2"
        >
          {INFO_KEYS.map((k) => (
            <div key={k} className="min-w-0 rounded-lg bg-tint-blue/60 px-2 py-1.5">
              <dt className="font-body text-[10px] font-bold uppercase tracking-wide text-challenge">
                {tStory(`card_${k}`)}
              </dt>
              <dd className="font-body text-xs leading-snug text-ink">{keyInfo[k]}</dd>
            </div>
          ))}
        </dl>
      ) : summary ? (
        <p
          data-testid="mission-key-info"
          className="line-clamp-2 border-t border-ink/5 bg-white px-4 py-2 text-center font-body text-xs text-ink/80"
        >
          <span className="font-bold text-challenge">{tStory('card_problem')}: </span>
          {summary}
        </p>
      ) : null}

      {/* Progress: all eight steps. Current = highlighted, visited = dark,
          not yet unlocked = hollow ring. */}
      <div className="flex items-center justify-center gap-1.5 bg-white px-4 pb-2.5 pt-1">
        {ALL_STEPS.map((step) => {
          const isCurrent = step === currentStep;
          const isVisited = !isCurrent && reachedSteps.has(step);
          const state = isCurrent ? 'current' : isVisited ? 'done' : 'locked';

          return (
            <button
              key={step}
              type="button"
              data-testid={`progress-dot-${step}`}
              data-state={state}
              disabled={!isCurrent && !isVisited}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={t('hud_step_aria', { step, state })}
              onClick={() => isVisited && onJumpTo(step)}
              className={[
                'flex shrink-0 items-center justify-center rounded-full font-display leading-none transition-all duration-300',
                isCurrent
                  ? 'h-7 w-7 bg-challenge text-xs text-white ring-2 ring-challenge ring-offset-2'
                  : isVisited
                    ? 'h-6 w-6 bg-[#1B5E86] text-[11px] text-white hover:scale-110'
                    : 'h-6 w-6 cursor-not-allowed border-2 border-challenge/40 bg-transparent text-[11px] text-challenge/60',
              ].join(' ')}
            >
              {step}
            </button>
          );
        })}
      </div>

      {xpOpen && (
        <XpInfoDialog missionXp={challenge.completion_xp} onClose={() => setXpOpen(false)} />
      )}

      {/* Mission menu dropdown */}
      {menuOpen && (
        <div
          data-testid="mission-menu"
          className="absolute left-0 right-0 top-full z-50 rounded-b-xl border-t border-ink/10 bg-white shadow-xl"
        >
          <ul role="list" className="py-2">
            {ALL_STEPS.map((step) => {
              const isReached = reachedSteps.has(step);
              const isCurrent = step === currentStep;

              return (
                <li key={step}>
                  <button
                    data-testid={`mission-step-${step}`}
                    onClick={() => handleStepClick(step)}
                    disabled={!isReached}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={[
                      'flex w-full items-center gap-3 px-5 py-3 text-left font-body text-sm transition-colors',
                      isReached
                        ? 'cursor-pointer hover:bg-tint-blue text-ink'
                        : 'cursor-not-allowed text-ink/30',
                    ].join(' ')}
                  >
                    {/* Dot indicator */}
                    <span
                      className={[
                        'h-2.5 w-2.5 shrink-0 rounded-full',
                        isReached ? 'bg-challenge' : 'bg-ink/20',
                      ].join(' ')}
                      aria-hidden="true"
                    />

                    {/* Step number */}
                    <span className="w-4 shrink-0 font-display text-xs text-ink/50">
                      {step}
                    </span>

                    {/* Step name */}
                    <span className="flex-1">{t(`step_name_${step}`)}</span>

                    {/* Current indicator */}
                    {isCurrent && (
                      <span className="text-challenge text-xs" aria-hidden="true">
                        ←
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
