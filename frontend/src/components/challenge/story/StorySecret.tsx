'use client';

import { useTranslations } from 'next-intl';
import { ChapterBanner, Popi, backClass, pillCtaClass } from './StoryBits';
import type { ChallengeDetail, MissionStory } from './types';
import type { MissionGame, GameUpdate } from './useMissionGame';

interface Props {
  challenge: ChallengeDetail;
  story: MissionStory;
  game: MissionGame;
  update: GameUpdate;
  onNext: () => void;
  onBack: () => void;
}

/** Step 4 as a story: the design secret revealed, then "Predict first!" —
 *  the kid guesses each item, and the answer flips over with a splash. */
export default function StorySecret({ challenge, story, game, update, onNext, onBack }: Props) {
  const t = useTranslations('story');
  const p = story.predict;
  const done = p.items.every((_, i) => game.predictions[i] !== undefined);

  return (
    <div data-testid="story-secret" className="flex flex-col gap-5 py-4">
      <ChapterBanner story={story} step="design_secret" />
      <Popi text={story.guide.design_secret} />

      <div className="story-rise flex flex-col gap-2 rounded-card bg-gradient-to-br from-white from-60% to-tint-blue p-5">
        <p className="font-display text-xs text-challenge">{t('secret_unlocked')}</p>
        <p className="font-body text-base text-ink">{challenge.design_secret}</p>
      </div>

      <div data-testid="predict-game" className="flex flex-col gap-3 rounded-card bg-white p-5">
        <p className="font-display text-xs text-challenge">{p.prompt}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {p.items.map((item, i) => {
            const guess = game.predictions[i];
            const answered = guess !== undefined;
            return (
              <div
                key={item.label}
                data-testid={`predict-item-${i}`}
                className="relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl bg-tint-blue p-4 text-center"
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 bottom-0 bg-[#5cc7ee]/35 transition-all duration-700 ${answered ? 'h-[44%]' : 'h-0'}`}
                />
                <span
                  aria-hidden="true"
                  className={`relative text-4xl transition-transform duration-700 ${answered ? 'story-float' : ''}`}
                >
                  {item.emoji}
                </span>
                <span className="relative font-body text-sm font-bold text-ink">{item.label}</span>
                {answered ? (
                  <span className="story-pop relative font-body text-sm font-bold text-ink" aria-live="polite">
                    {guess === item.answer ? '✅' : '💡'} {t('predict_answer', { answer: p.choices[item.answer] })}
                  </span>
                ) : (
                  <span className="relative flex flex-wrap justify-center gap-1.5">
                    {p.choices.map((c, ci) => (
                      <button
                        key={c}
                        type="button"
                        data-testid={`predict-${i}-${ci}`}
                        onClick={() => update((g) => ({ predictions: { ...g.predictions, [i]: ci } }))}
                        className="rounded-pill border-2 border-ink/10 bg-white px-3 py-1 font-body text-xs font-bold text-ink hover:border-challenge"
                      >
                        {c}
                      </button>
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="font-body text-sm text-ink/60" aria-live="polite">
          {done ? p.explain : t('predict_hint')}
        </p>
      </div>

      <button type="button" data-testid="secret-next" onClick={onNext} disabled={!done} className={pillCtaClass}>
        {t('secret_next')}
      </button>
      <button type="button" onClick={onBack} className={backClass}>
        {t('back')}
      </button>
    </div>
  );
}
