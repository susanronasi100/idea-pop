'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChapterBanner, Character3D, Popi, RewardPop, backClass, pillCtaClass } from './StoryBits';
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

/** Step 3 as a story: flip each nature hero's card (organism → trick → what
 *  it does), then the Match-the-trick game. All matched on the first try
 *  earns the Clue Detective badge. */
export default function StoryClues({ story, game, update, award, onNext, onBack }: Props) {
  const t = useTranslations('story');
  const [selected, setSelected] = useState<number | null>(null);
  const [missBin, setMissBin] = useState<string | null>(null);
  const cards = story.clue_cards;
  const allOpen = cards.every((_, i) => game.flipped.includes(i));
  const matchedAll = cards.every((_, i) => game.matched[i] !== undefined);

  function flip(i: number) {
    if (!game.flipped.includes(i)) update((g) => ({ flipped: [...g.flipped, i] }));
  }

  function drop(groupKey: string) {
    if (selected === null) return;
    if (cards[selected].group === groupKey) {
      const matched: Record<string, string> = { ...game.matched, [selected]: groupKey };
      update({ matched });
      setSelected(null);
      setMissBin(null);
      if (cards.every((_, i) => matched[i] !== undefined) && !game.matchMissed) award('clue');
    } else {
      update({ matchMissed: true });
      setMissBin(groupKey);
    }
  }

  return (
    <div data-testid="story-clues" className="flex flex-col gap-5 py-4">
      <ChapterBanner story={story} step="nature_clues" />
      <Popi text={story.guide.nature_clues} />

      <div>
        <h2 className="font-display text-2xl text-challenge">{story.function_question}</h2>
        <p className="font-body text-sm text-ink/60">
          {t('clues_progress', { opened: game.flipped.length, total: cards.length })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((c, i) => {
          const open = game.flipped.includes(i);
          return (
            <button
              key={c.name}
              type="button"
              data-testid={`clue-card-${i}`}
              data-open={open}
              onClick={() => flip(i)}
              aria-label={open ? t('clue_opened', { name: c.name }) : t('clue_closed', { name: c.name })}
              className="story-flip min-h-[220px] text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge rounded-card"
            >
              <span className="story-flip-inner block min-h-[220px]">
                <span className="story-face flex flex-col items-center justify-center gap-1 rounded-card bg-white p-4 text-center shadow-sm">
                  <Character3D src={c.image} emoji={c.emoji} alt={c.name} size={96} />
                  <span className="font-display text-base text-ink">{c.name}</span>
                  <span className="font-body text-xs text-ink/60">{c.tagline} · {t('tap_to_open')}</span>
                </span>
                <span className="story-face story-back flex flex-col gap-1.5 rounded-card bg-white p-4 shadow-sm">
                  <span className="font-display text-base text-ink">{c.emoji} {c.name}</span>
                  <span className="font-display text-xs text-explore">{t('its_trick')}</span>
                  <span className="font-body text-sm text-ink">{c.trick}</span>
                  <span className="font-display text-xs text-explore">{t('what_it_does')}</span>
                  <span className="font-body text-sm text-ink">{c.does}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {allOpen && (
        <div data-testid="match-game" className="story-rise flex flex-col gap-3 rounded-card bg-white p-5">
          <p className="font-display text-xs text-challenge">{t('match_title')}</p>
          <p className="font-body text-sm text-ink">{t('match_how')}</p>
          <div className="flex flex-wrap gap-2">
            {cards.map((c, i) => {
              const done = game.matched[i] !== undefined;
              return (
                <button
                  key={c.name}
                  type="button"
                  data-testid={`match-hero-${i}`}
                  disabled={done}
                  aria-pressed={selected === i}
                  onClick={() => setSelected(selected === i ? null : i)}
                  className={[
                    'rounded-pill border-2 px-4 py-2 font-body text-sm font-semibold transition-all',
                    done ? 'border-ink/10 opacity-35' : selected === i ? 'scale-105 border-challenge bg-challenge/10' : 'border-ink/10 bg-white hover:border-challenge',
                  ].join(' ')}
                >
                  {c.emoji} {c.name}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {story.match_groups.map((g) => (
              <button
                key={g.key}
                type="button"
                data-testid={`match-group-${g.key}`}
                onClick={() => drop(g.key)}
                className={[
                  'flex min-h-[92px] flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed p-3 text-center font-body text-sm font-bold transition-colors',
                  missBin === g.key ? 'story-shake border-coral' : selected !== null ? 'border-challenge bg-white' : 'border-ink/20 bg-white/60',
                ].join(' ')}
              >
                {g.label}
                <span className="flex gap-1 text-2xl">
                  {cards.map((c, i) =>
                    game.matched[i] === g.key ? (
                      <span key={c.name} className="story-pop" aria-label={c.name}>{c.emoji}</span>
                    ) : null,
                  )}
                </span>
              </button>
            ))}
          </div>
          <p className="font-body text-sm text-ink/60" aria-live="polite">
            {matchedAll
              ? game.matchMissed
                ? t('match_done_retry')
                : t('match_done_perfect')
              : missBin
                ? t('match_miss')
                : t('match_hint')}
          </p>
          {matchedAll && !game.matchMissed && <RewardPop text={t('badge_earned', { badge: t('badge_clue') })} />}
        </div>
      )}

      <button type="button" data-testid="clues-next" onClick={onNext} disabled={!matchedAll} className={pillCtaClass}>
        {t('clues_next')}
      </button>
      <button type="button" onClick={onBack} className={backClass}>
        {t('back')}
      </button>
    </div>
  );
}
