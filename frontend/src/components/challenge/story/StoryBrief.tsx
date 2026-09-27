'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChapterBanner, Character3D, Popi, ctaClass, optionClass } from './StoryBits';
import type { ChallengeDetail, MissionStory } from './types';
import type { MissionGame } from './useMissionGame';

interface Props {
  challenge: ChallengeDetail;
  story: MissionStory;
  game: MissionGame;
  update: (patch: Partial<MissionGame>) => void;
  onNext: () => void;
}

const CARD_KEYS = ['hero', 'place', 'problem', 'goal', 'rules', 'helpers'] as const;

/** Step 1 as a story: three opening pages, the scene with the 3D hero, the
 *  story card that defines the project, and a one-tap quick check. */
export default function StoryBrief({ challenge, story, game, update, onNext }: Props) {
  const t = useTranslations('story');
  const [wrong, setWrong] = useState<number | null>(null);
  const qc = story.quick_check;

  function answer(i: number) {
    if (i === qc.answer) {
      setWrong(null);
      update({ quickCheckDone: true });
    } else {
      setWrong(i);
    }
  }

  return (
    <div data-testid="story-brief" className="flex flex-col gap-5 py-4">
      <ChapterBanner story={story} step="brief" />

      <div className="grid gap-3 sm:grid-cols-3">
        {story.opening.map((page, i) => (
          <div
            key={page.beat}
            className={`story-rise flex flex-col gap-1.5 rounded-2xl p-4 ${i === 2 ? 'bg-tint-blush' : 'bg-tint-cream'}`}
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            <span className="text-3xl" aria-hidden="true">{page.emoji}</span>
            <p className="font-display text-challenge">{page.beat}</p>
            <p className="font-body text-sm text-ink">{page.text}</p>
          </div>
        ))}
      </div>

      {/* The scene: the story's backdrop with the 3D hero standing in it */}
      <div className="relative flex min-h-[220px] items-end justify-start overflow-hidden rounded-card bg-white">
        {story.scene_image && (
          <Image
            src={story.scene_image}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-cover"
            priority
          />
        )}
        <Character3D
          src={story.hero.image}
          emoji={story.hero.emoji}
          alt={t('hero_alt', { name: story.hero.name, role: story.hero.role })}
          size={170}
          className="relative z-10 m-3"
        />
      </div>

      <Popi text={story.guide.brief} />

      <div className="flex flex-col gap-3 rounded-card bg-white p-5">
        <p className="font-display text-xs text-challenge">{t('your_mission')}</p>
        <h2 className="font-display text-2xl text-ink">{challenge.title}</h2>
        <dl data-testid="story-card" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CARD_KEYS.map((k) => (
            <div key={k} className="rounded-xl bg-tint-blue p-2.5">
              <dt className="font-body text-[11px] font-bold uppercase tracking-wide text-challenge">{t(`card_${k}`)}</dt>
              <dd className="font-body text-sm text-ink">{story.card[k]}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-1 flex items-start gap-2">
          <span className="shrink-0 rounded-md bg-tint-lime px-2 py-1 font-body text-[11px] font-bold uppercase tracking-wide text-explore">
            {t('quick_check')}
          </span>
          <p className="font-body text-sm font-semibold text-ink">{qc.question}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {qc.options.map((opt, i) => (
            <button
              key={opt}
              type="button"
              data-testid={`quick-check-${i}`}
              onClick={() => answer(i)}
              className={`flex-1 basis-28 ${optionClass(
                game.quickCheckDone && i === qc.answer ? 'right' : wrong === i ? 'wrong' : 'idle',
              )}`}
            >
              <span dir="auto">{opt}</span>
            </button>
          ))}
        </div>
        <p className="font-body text-sm text-ink/60" aria-live="polite">
          {game.quickCheckDone ? qc.right : wrong !== null ? qc.wrong : t('quick_check_hint')}
        </p>
      </div>

      <button
        type="button"
        data-testid="story-start"
        onClick={onNext}
        disabled={!game.quickCheckDone}
        className={ctaClass}
      >
        {t('lets_start')}
      </button>
    </div>
  );
}
