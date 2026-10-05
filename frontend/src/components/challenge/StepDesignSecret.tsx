'use client';

import { useTranslations } from 'next-intl';
import { btnSecondary, btnText } from '@/components/challenge/buttons';

type ChallengeDetail = import('@/lib/api/schema').components['schemas']['ChallengeDetail'];

interface StepDesignSecretProps {
  challenge: ChallengeDetail;
  ageMode: 'young' | 'older';
  onNext: () => void;
  onBack: () => void;
}

export default function StepDesignSecret({
  challenge,
  ageMode,
  onNext,
  onBack,
}: StepDesignSecretProps) {
  const t = useTranslations('mission');

  return (
    <div data-testid="step-design-secret" className="flex flex-col gap-6">
      <h2 className="font-display text-2xl text-challenge">{t('secret_heading')}</h2>

      {ageMode === 'older' && challenge.design_secret_story && (
        <div className="bg-tint-blue rounded-card p-4 flex flex-col gap-1">
          <span className="font-body text-xs text-ink/50 uppercase tracking-wide">
            {t('secret_story_label')}
          </span>
          <p className="font-body text-sm text-ink">{challenge.design_secret_story}</p>
        </div>
      )}

      <div className="bg-challenge text-white rounded-card p-6 text-center shadow-md">
        <p
          data-testid="design-secret-text"
          className="font-display text-2xl leading-snug"
        >
          {challenge.design_secret}
        </p>
      </div>

      {ageMode === 'older' && (
        <p className="font-body text-xs text-ink/50 text-center italic">
          {t('secret_biomimicry_note')}
        </p>
      )}

      <div className="flex flex-col items-center gap-3 pt-2">
        <button
          onClick={onNext}
          className={`${btnSecondary} w-full sm:w-auto`}
        >
          {t('secret_got_it')}
        </button>

        <button
          onClick={onBack}
          className={btnText}
        >
          {t('back')}
        </button>
      </div>
    </div>
  );
}
