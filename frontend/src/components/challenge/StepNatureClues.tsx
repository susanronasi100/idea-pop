'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { btnPrimary, btnText } from '@/components/challenge/buttons';

type ChallengeDetail = import('@/lib/api/schema').components['schemas']['ChallengeDetail'];

interface StepNatureCluesProps {
  challenge: ChallengeDetail;
  ageMode: 'young' | 'older';
  onNext: () => void;
  onBack: () => void;
}

export default function StepNatureClues({
  challenge,
  ageMode,
  onNext,
  onBack,
}: StepNatureCluesProps) {
  const t = useTranslations('mission');
  const [watched, setWatched] = useState<Set<number>>(new Set());

  const toggleWatched = (index: number) => {
    setWatched((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Defensive: never index a possibly-missing array (the white-screen bug).
  const clues = challenge.nature_clues ?? [];
  const exampleXp = clues[0]?.xp_reward ?? 5;

  return (
    <div data-testid="step-nature-clues" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl text-challenge">
          {t('clues_heading')}
        </h2>
        <p className="font-body text-sm text-ink/50">
          {t('clue_xp_each', { xp: exampleXp })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {clues.map((clue, index) => {
          const isWatched = watched.has(index);

          return (
            <div
              key={index}
              data-testid={`nature-clue-${index}`}
              className="relative bg-white rounded-card shadow-sm p-4 flex flex-col gap-2"
            >
              {isWatched && (
                <div className="absolute top-2 right-2 text-explore text-xl leading-none">
                  ✅
                </div>
              )}

              <span className="text-4xl" aria-hidden="true">{clue.emoji}</span>

              {/* The clue itself is the star — habitat is just a tag. */}
              <p className="font-body font-bold text-base text-ink">{clue.description}</p>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-tint-lime text-ink/70 text-xs px-2 py-0.5 rounded-full">
                  {clue.title}
                </span>
                <span dir="ltr" className="bg-explore/10 text-explore text-xs px-2 py-0.5 rounded-full">
                  {t('xp_chip', { xp: clue.xp_reward })}
                </span>

                {clue.explore_video_id && (
                  <button
                    data-testid={`watch-clue-${index}`}
                    onClick={() => toggleWatched(index)}
                    className={`${btnText} self-start`}
                  >
                    {isWatched ? t('watched') : t('watch_clip')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3 pt-2">
        <button
          onClick={onNext}
          className={`${btnPrimary} w-full sm:w-auto`}
        >
          {t('got_it_secret')}
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
