'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

const ALL_STEPS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

interface MissionHUDProps {
  challenge: { title: string; emoji: string; completion_xp: number };
  currentStep: number; // 1-8
  reachedSteps: Set<number>;
  onJumpTo: (step: number) => void;
  ideaPath?: 'yes' | 'no' | null;
  /** Story missions: finished chapters show as gold stars (one per step). */
  starTrail?: boolean;
}

export default function MissionHUD({
  challenge,
  currentStep,
  reachedSteps,
  onJumpTo,
  starTrail = false,
}: MissionHUDProps) {
  const t = useTranslations('challenge');
  const [menuOpen, setMenuOpen] = useState(false);

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

        {/* Right: XP badge — dir=ltr so "+N XP" doesn't reorder in RTL */}
        <span dir="ltr" className="shrink-0 rounded-pill bg-challenge/10 px-3 py-1 font-body text-xs font-semibold text-challenge">
          {t('hud_xp', { xp: challenge.completion_xp })}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 bg-white px-4 pb-2.5">
        {ALL_STEPS.map((step) => {
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          const isFuture = step > currentStep;

          if (starTrail && (isCompleted || isCurrent)) {
            return (
              <span
                key={step}
                data-testid={`progress-dot-${step}`}
                role="img"
                aria-label={t('hud_step_aria', { step, state: isCurrent ? 'current' : 'done' })}
                className={[
                  'flex h-5 w-5 items-center justify-center rounded-full text-[13px] leading-none transition-all duration-300',
                  isCompleted ? 'story-pop bg-[#fff5d1] text-[#f2b705]' : 'bg-challenge/10 text-challenge ring-2 ring-challenge ring-offset-1',
                ].join(' ')}
              >
                {isCompleted ? '★' : step}
              </span>
            );
          }

          return (
            <span
              key={step}
              data-testid={`progress-dot-${step}`}
              // aria-label is prohibited on a bare span; img role permits it
              role="img"
              aria-label={t('hud_step_aria', {
                step,
                state: isCurrent ? 'current' : isCompleted ? 'done' : 'other',
              })}
              className={[
                'block rounded-full transition-all duration-300',
                isCompleted
                  ? 'h-2.5 w-2.5 bg-challenge'
                  : isCurrent
                    ? 'h-2.5 w-2.5 bg-challenge ring-2 ring-challenge ring-offset-1 animate-pulse'
                    : isFuture
                      ? 'h-2 w-2 bg-ink/20'
                      : '',
              ].join(' ')}
            />
          );
        })}
      </div>

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
