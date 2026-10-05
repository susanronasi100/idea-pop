'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePopiVoice } from '@/lib/hooks/usePopiVoice';
import { useAutoNarration } from '@/lib/hooks/useAutoNarration';
import { joinSegments } from '@/lib/narration';
import { SceneStage, Popi, ctaClass, optionClass } from './StoryBits';
import StoryPictureBook from './StoryPictureBook';
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
  const pictureBook = story.opening.length > 0 && story.opening.every((p) => p.image);
  // Popi reads the three opening cards by himself, then his own line (TEMP rule 19).
  // The picture book runs its own reading, so this one stays off there.
  const voice = usePopiVoice(useLocale());
  const auto = useAutoNarration({
    id: challenge.id,
    enabled: !pictureBook,
    voice,
    pages: story.opening.map((p) => joinSegments([p.beat, p.text])),
    finale: story.guide.brief,
    onFinale: () =>
      document.querySelector('[data-testid="story-popi"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
  });

  // A mission whose opening pages carry pictures tells its start as a picture
  // book, one page at a time, and goes straight on from the last page.
  if (pictureBook) {
    return (
      <StoryPictureBook
        pages={story.opening}
        define={story.define_problem ?? null}
        answers={game.defineAnswers ?? {}}
        onAnswer={(key, value) => update({ defineAnswers: { ...(game.defineAnswers ?? {}), [key]: value } })}
        done={game.defineDone ?? []}
        onDoneChange={(next) => update({ defineDone: next })}
        challengeId={challenge.id}
        celebrated={game.badges.includes('define')}
        onCelebrated={() => update({ badges: game.badges.includes('define') ? game.badges : [...game.badges, 'define'] })}
        onDone={onNext}
      />
    );
  }

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
      {auto.phase === 'blocked' && (
        <p
          data-testid="popi-tap-hint"
          className="story-pop self-center rounded-pill bg-white px-4 py-2 font-body text-sm font-bold text-challenge shadow-sm"
        >
          <span aria-hidden="true">👆 </span>
          {t('tap_to_listen')}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {story.opening.map((page, i) => (
          <div
            key={page.beat}
            className={`story-rise flex flex-col gap-1.5 rounded-2xl p-4 transition-shadow ${i === 2 ? 'bg-tint-blush' : 'bg-tint-cream'} ${
              auto.reading === i ? 'ring-2 ring-challenge ring-offset-2' : ''
            }`}
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            <span className="text-3xl" aria-hidden="true">{page.emoji}</span>
            <p className="font-display text-challenge">{page.beat}</p>
            <p className="font-body text-sm text-ink">{page.text}</p>
          </div>
        ))}
      </div>

      {/* The scene: the story's backdrop with the 3D hero standing in it */}
      <SceneStage story={story} alt={t('hero_alt', { name: story.hero.name, role: story.hero.role })} priority />

      <Popi text={story.guide.brief} grand talking={auto.phase === 'finale' && voice.speaking} />

      <div className="flex flex-col gap-3 rounded-card bg-white p-5">
        <p className="font-body font-bold text-xs text-challenge">{t('your_mission')}</p>
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
