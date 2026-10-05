'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import MissionHints from './MissionHints';
import MissionHelper from './MissionHelper';
import { GAME_BY_SLUG } from './gameEmbeds';
import { btnPrimary, btnText } from '@/components/challenge/buttons';

// Dark-launch flag for the scoped AI helper (server enforces the real gates).
const HELPER_ON = process.env.NEXT_PUBLIC_MISSION_HELPER === 'true';

type ChallengeDetail = import('@/lib/api/schema').components['schemas']['ChallengeDetail'];

interface StepSkillProps {
  challenge: ChallengeDetail;
  ageMode: 'young' | 'older';
  onNext: () => void;
  onBack: () => void;
}

export default function StepSkill({
  challenge,
  ageMode: _ageMode,
  onNext,
  onBack,
}: StepSkillProps) {
  const t = useTranslations('mission');
  const [toastVisible, setToastVisible] = useState(false);
  const game = GAME_BY_SLUG[challenge.slug];

  const handleOpenLesson = () => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  return (
    <div data-testid="step-skill" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl text-challenge">{t('skill_heading')}</h2>
        <p className="font-body text-sm text-ink/50">{t('skill_optional')}</p>
      </div>

      {challenge.skill_instructions && (
        <div data-testid="skill-instructions" className="bg-white rounded-card shadow-sm p-4">
          <p className="font-body text-sm text-ink whitespace-pre-line">
            {challenge.skill_instructions}
          </p>
        </div>
      )}

      {challenge.skill_lesson_id ? (
        <div
          data-testid="skill-lesson-card"
          className="bg-white rounded-card shadow-sm p-4 flex items-center gap-4"
        >
          <span className="text-4xl shrink-0">📚</span>

          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <p className="font-body font-bold text-base text-ink">{t('skill_lesson_title')}</p>
            <span dir="ltr" className="bg-library/10 text-library text-xs px-2 py-0.5 rounded-full w-fit">
              {t('xp_chip', { xp: 10 })}
            </span>
          </div>

          <button
            onClick={handleOpenLesson}
            className={btnPrimary}
          >
            {t('skill_lesson_btn')}
          </button>
        </div>
      ) : !challenge.skill_instructions ? (
        <div className="bg-white rounded-card shadow-sm p-4">
          <p className="font-body text-sm text-ink/50">
            {t('skill_none')}
          </p>
        </div>
      ) : null}

      {/* The guess-who mission's on-device game — visible right on the step */}
      {game && <game.Panel defaultOpen />}

      <MissionHints hints={challenge.skill_hints ?? []} />

      {HELPER_ON && <MissionHelper challengeId={challenge.id} step={5} />}

      {toastVisible && (
        <div
          role="status"
          aria-live="polite"
          className="bg-white rounded-card shadow-md border border-library/20 p-3 text-center"
        >
          <p className="font-body text-sm text-ink">
            {t('skill_toast')}
          </p>
        </div>
      )}

      <div className="flex flex-col items-center gap-3 pt-2">
        <button
          onClick={onNext}
          className={`${btnPrimary} w-full sm:w-auto`}
        >
          {t('continue_sketch')}
        </button>

        <button
          data-testid="skip-skill"
          onClick={onNext}
          className={btnText}
        >
          {t('skip_to_idea')}
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
