'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Character3D, Popi, StepNav, pillCtaClass } from './StoryBits';
import type { MissionStory } from './types';
import type { BadgeKey, MissionGame, GameUpdate } from './useMissionGame';

interface Props {
  story: MissionStory;
  game: MissionGame;
  update: GameUpdate;
  award: (b: BadgeKey) => void;
  onNext: () => void;
  onBack: () => void;
}

/** Step 3 as a story: turn each nature hero's card (photo → trick → what it
 *  does). Meeting all of them earns the Clue Detective badge. */
export default function StoryClues({ story, game, update, award, onNext, onBack }: Props) {
  const t = useTranslations('story');
  // Which cards show their words right now; a card can be turned back to its photo.
  const [turned, setTurned] = useState<number[]>([]);
  const cards = story.clue_cards;
  const allOpen = cards.every((_, i) => game.flipped.includes(i));

  function flip(i: number) {
    if (!game.flipped.includes(i)) {
      const flipped = [...game.flipped, i];
      update({ flipped });
      // Meeting every nature hero earns the Clue Detective badge.
      if (cards.every((_, k) => flipped.includes(k))) award('clue');
    }
    setTurned((v) => (v.includes(i) ? v.filter((x) => x !== i) : [...v, i]));
  }


  return (
    <div data-testid="story-clues" className="flex flex-col gap-5 py-4">
      <Popi text={story.guide.nature_clues} />

      <div>
        <h2 className="font-display text-2xl text-challenge">{story.function_question}</h2>
        <p className="font-body text-sm text-ink/60">
          {t('clues_progress', { opened: game.flipped.length, total: cards.length })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((c, i) => {
          const open = turned.includes(i);
          return (
            <button
              key={c.name}
              type="button"
              data-testid={`clue-card-${i}`}
              data-open={open}
              onClick={() => flip(i)}
              aria-label={open ? t('clue_opened', { name: c.name }) : t('clue_closed', { name: c.name })}
              className="story-flip min-h-[320px] rounded-[20px] text-start focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0F3F63]"
            >
              <span className="story-flip-inner block min-h-[320px]">
                {/* Front: the nature hero's picture. */}
                <span className="story-face flex flex-col items-center justify-center gap-2 rounded-[20px] border border-[#58C6EE] bg-white p-5 text-center shadow-sm">
                  <Character3D src={c.image} emoji={c.emoji} alt={c.name} size={170} />
                  <span className="font-body text-2xl font-extrabold text-ink">{c.name}</span>
                  <span className="font-body text-base font-semibold text-[#4A5560]">{c.tagline}</span>
                  <span className="font-body text-sm font-bold text-[#1A6FA6]">{t('tap_to_open')}</span>
                </span>
                {/* Back: the words. Name and the two labels are big and bold (TEMP rule 29). */}
                <span className="story-face story-back flex flex-col gap-2 rounded-[20px] border border-[#58C6EE] bg-white p-5 shadow-sm">
                  <span className="font-body text-2xl font-extrabold text-ink">{c.name}</span>
                  <span className="font-body text-lg font-extrabold text-[#1E7A44]">{t('its_trick')}</span>
                  <span className="font-body text-base font-medium leading-snug text-ink">{c.trick}</span>
                  <span className="font-body text-lg font-extrabold text-[#1E7A44]">{t('what_it_does')}</span>
                  <span className="font-body text-base font-medium leading-snug text-ink">{c.does}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <StepNav onBack={onBack} backLabel={t('back')}>
        <button type="button" data-testid="clues-next" onClick={onNext} disabled={!allOpen} className={pillCtaClass}>
          {t('clues_next')}
        </button>
      </StepNav>
    </div>
  );
}

