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
      {/* z-50 keeps the bar above the tap-outside backdrop, so ✕ still works */}
      <div className="relative z-50 flex items-center gap-2 bg-white px-4 py-3 shadow-sm">
        {/* Left: menu toggle (☰ opens, ✕ closes) */}
        <button
          data-testid="mission-menu-button"
          aria-label={menuOpen ? t('hud_menu_close_aria') : t('hud_menu_aria')}
          aria-expanded={menuOpen}
          onClick={() => {
            setXpOpen(false);
            setMenuOpen((v) => !v);
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-tint-blue transition-colors"
        >
          <span className="text-lg leading-none" aria-hidden="true">
            {menuOpen ? '✕' : '☰'}
          </span>
        </button>

        {/* Center: title */}
        <h1
          data-testid="mission-title"
          className="line-clamp-2 min-w-0 flex-1 text-center font-display text-xl leading-tight text-ink sm:text-2xl md:text-3xl"
        >
          {challenge.emoji} {challenge.title}
        </h1>

        {/* Right: XP badge — a button that explains XP. dir=ltr so "+N XP"
            doesn't reorder in RTL. */}
        <button
          type="button"
          dir="ltr"
          data-testid="hud-xp-button"
                    aria-label={t('hud_xp_aria', { xp: challenge.completion_xp })}
          aria-expanded={xpOpen}
          onClick={() => {
            setMenuOpen(false);
            setXpOpen((v) => !v);
          }}
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

      {/* Key info: the problem statement and constraints, from step 2 on
          (step 1, the Brief, already shows the full story card). */}
      {currentStep < 2 ? null : keyInfo ? (
        <dl
          data-testid="mission-key-info"
          className="grid grid-cols-3 gap-2 border-t border-ink/5 bg-white px-4 py-2.5"
        >
          {INFO_KEYS.map((k) => (
            <div key={k} className="min-w-0 rounded-lg bg-tint-blue/60 px-2.5 py-2">
              <dt className="font-body text-xs font-bold uppercase tracking-wide text-challenge sm:text-sm">
                {tStory(`card_${k}`)}
              </dt>
              <dd className="font-body text-sm leading-snug text-ink sm:text-base">{keyInfo[k]}</dd>
            </div>
          ))}
        </dl>
      ) : summary ? (
        <p
          data-testid="mission-key-info"
          className="line-clamp-2 border-t border-ink/5 bg-white px-4 py-2.5 text-center font-body text-sm text-ink/80 sm:text-base"
        >
          <span className="font-bold text-challenge">{tStory('card_problem')}: </span>
          {summary}
        </p>
      ) : null}

      {/* Progress: all eight steps. Current = highlighted, visited = dark,
          not yet unlocked = hollow ring. Under them, the current step's name,
          the same name the menu uses. */}
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
                  ? 'h-7 w-7 bg-[#C0F0FF] text-sm text-[#333333] ring-2 ring-challenge ring-offset-2'
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
      <p
        data-testid="progress-label"
        aria-live="polite"
        className="bg-white px-4 pb-2.5 text-center font-body text-sm font-semibold text-challenge"
      >
        {t(`step_name_${currentStep}`)}
      </p>

      {xpOpen && (
        <XpInfoDialog missionXp={challenge.completion_xp} onClose={() => setXpOpen(false)} />
      )}

      {/* Mission menu dropdown */}
      {menuOpen && (
        <div
          data-testid="mission-menu-backdrop"
          className="fixed inset-0 z-40"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}
      {menuOpen && (
        <div
          data-testid="mission-menu"
          className="absolute left-0 right-0 top-full z-50 rounded-b-xl border-t border-ink/10 bg-white shadow-xl"
        >
          <ul role="list" className="flex flex-col gap-1 p-2">
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
                      'flex w-full items-center gap-3 rounded-xl border-2 px-5 py-3 text-start font-body text-lg transition-colors',
                      isCurrent
                        ? 'border-[#8FD3F7] bg-tint-blue/60 text-ink'
                        : isReached
                          ? 'border-transparent cursor-pointer hover:bg-tint-blue text-ink'
                          : 'border-transparent cursor-not-allowed text-ink/30',
                    ].join(' ')}
                  >
                    {/* Dot indicator */}
                    <span
                      className={[
                        'h-3 w-3 shrink-0 rounded-full',
                        isReached ? 'bg-challenge' : 'bg-ink/20',
                      ].join(' ')}
                      aria-hidden="true"
                    />

                    {/* Step number */}
                    <span className="w-5 shrink-0 font-display text-base text-ink/50">
                      {step}
                    </span>

                    {/* Step name */}
                    <span className="flex-1">{t(`step_name_${step}`)}</span>

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
