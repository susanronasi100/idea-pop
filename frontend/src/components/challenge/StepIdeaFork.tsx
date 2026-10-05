'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { btnText } from '@/components/challenge/buttons';

type ChallengeDetail = import('@/lib/api/schema').components['schemas']['ChallengeDetail'];
type AgeMode = import('@/lib/hooks/useAgeMode').AgeMode;

interface StepIdeaForkProps {
  challenge: ChallengeDetail;
  ageMode: AgeMode;
  onYes: () => void; // user has an idea → jump to step 6
  onNo: () => void;  // inspire me → go to step 3
  onBack: () => void; // back to step 1
}

export default function StepIdeaFork({
  challenge: _challenge,
  ageMode: _ageMode,
  onYes,
  onNo,
  onBack,
}: StepIdeaForkProps) {
  const t = useTranslations('mission');

  return (
    <div data-testid="step-idea-fork" className="mx-auto flex max-w-lg flex-col items-center gap-8 px-4 py-8">
      {/* Heading */}
      <h2 className="font-display text-2xl text-challenge text-center">
        {t('fork_heading')}
      </h2>

      {/* Two choice cards */}
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {/* YES card */}
        <button
          data-testid="idea-yes"
          onClick={onYes}
          className="flex cursor-pointer flex-col items-center gap-3 rounded-card border-2 border-transparent bg-white p-6 text-center shadow-sm transition-all hover:border-challenge hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2"
        >
          <span className="text-5xl" role="img" aria-label={t('fork_yes_emoji_label')}>
            💡
          </span>
          <span className="font-display text-lg text-ink">{t('fork_yes_title')}</span>
          <span className="font-body text-sm text-ink/50">{t('fork_yes_sub')}</span>
        </button>

        {/* NO card */}
        <button
          data-testid="idea-no"
          onClick={onNo}
          className="flex cursor-pointer flex-col items-center gap-3 rounded-card border-2 border-transparent bg-white p-6 text-center shadow-sm transition-all hover:border-challenge hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2"
        >
          <span className="text-5xl" role="img" aria-label={t('fork_no_emoji_label')}>
            🌿
          </span>
          <span className="font-display text-lg text-ink">{t('fork_no_title')}</span>
          <span className="font-body text-sm text-ink/50">{t('fork_no_sub')}</span>
        </button>
      </div>

      {/* Back link */}
      <button
        onClick={onBack}
        className={btnText}
      >
        {t('back')}
      </button>
    </div>
  );
}
