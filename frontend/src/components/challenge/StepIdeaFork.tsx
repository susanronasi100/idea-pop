'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { btnPrimary, btnSecondary } from '@/components/challenge/buttons';

const card =
  'group flex cursor-pointer flex-col items-center gap-4 rounded-[20px] bg-white p-5 pb-6 text-center shadow-[0_6px_18px_rgba(0,0,0,0.12)] transition-[transform,box-shadow] duration-[800ms] ease-out hover:scale-[1.03] hover:shadow-[0_12px_28px_rgba(27,58,107,0.22)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2';

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
    <div data-testid="step-idea-fork" className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-8">
      {/* Heading */}
      <h2 className="font-display text-2xl text-challenge text-center">
        {t('fork_heading')}
      </h2>

      {/* Two choice cards, in the site's card look: rounded, soft shadow, a tinted picture
          panel, and the same slow grow on hover as the sign-up cards. */}
      <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
        <button
          type="button"
          data-testid="idea-yes"
          onClick={onYes}
          className={card}
        >
          <span className="flex w-full items-center justify-center rounded-[16px] bg-[#F3FFC2] py-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- a transparent notebook drawing */}
            <img
              src="/challenge/fork/idea-yes.webp"
              alt={t('fork_yes_emoji_label')}
              width={360}
              height={360}
              className="h-44 w-44 object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.18)] transition-transform duration-[800ms] ease-out group-hover:-rotate-3 group-hover:scale-105 sm:h-52 sm:w-52"
            />
          </span>
          <span className="font-display text-2xl text-ink">{t('fork_yes_title')}</span>
          <span className={`${btnPrimary} pointer-events-none`}>{t('fork_yes_sub')} →</span>
        </button>

        <button
          type="button"
          data-testid="idea-no"
          onClick={onNo}
          className={card}
        >
          <span className="flex w-full items-center justify-center rounded-[16px] bg-[#F1D8FB] py-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- a transparent notebook drawing */}
            <img
              src="/challenge/fork/idea-no.webp"
              alt={t('fork_no_emoji_label')}
              width={360}
              height={360}
              className="h-44 w-44 object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.18)] transition-transform duration-[800ms] ease-out group-hover:-rotate-3 group-hover:scale-105 sm:h-52 sm:w-52"
            />
          </span>
          <span className="font-display text-2xl text-ink">{t('fork_no_title')}</span>
          <span className={`${btnPrimary} pointer-events-none`}>{t('fork_no_sub')} →</span>
        </button>
      </div>

      {/* Back link */}
      <button
        onClick={onBack}
        className={`${btnSecondary} self-center`}
      >
        {t('back')}
      </button>
    </div>
  );
}
