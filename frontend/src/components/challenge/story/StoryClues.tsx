'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Character3D, Popi, RewardPop, StepNav, pillCtaClass } from './StoryBits';
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
  // Which cards show their words right now; a card can be turned back to its photo.
  const [turned, setTurned] = useState<number[]>([]);
  const cards = story.clue_cards;
  const allOpen = cards.every((_, i) => game.flipped.includes(i));
  const matchedAll = cards.every((_, i) => game.matched[i] !== undefined);

  function flip(i: number) {
    if (!game.flipped.includes(i)) update((g) => ({ flipped: [...g.flipped, i] }));
    setTurned((v) => (v.includes(i) ? v.filter((x) => x !== i) : [...v, i]));
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

      {allOpen && (
        <div data-testid="match-game" className="story-rise flex flex-col gap-3 rounded-card bg-white p-5">
          <p className="font-display text-2xl text-challenge">{t('match_title')}</p>
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
                    'inline-flex items-center gap-2 rounded-pill border-2 py-1.5 ps-1.5 pe-4 font-body text-base font-bold transition-all',
                    done ? 'border-ink/10 opacity-35' : selected === i ? 'scale-105 border-challenge bg-challenge/10' : 'border-ink/10 bg-white hover:border-challenge',
                  ].join(' ')}
                >
                  <ClueThumb image={c.image} emoji={c.emoji} /> {c.name}
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
                      <span key={c.name} className="story-pop" aria-label={c.name}><ClueThumb image={c.image} emoji={c.emoji} size={40} /></span>
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

      <StepNav onBack={onBack} backLabel={t('back')}>
        <button type="button" data-testid="clues-next" onClick={onNext} disabled={!matchedAll} className={pillCtaClass}>
          {t('clues_next')}
        </button>
      </StepNav>
    </div>
  );
}

/** A nature hero's small round photo (or its emoji when there's no photo yet). */
function ClueThumb({ image, emoji, size = 32 }: { image: string | null; emoji: string; size?: number }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element -- a small transparent cut-out
    <img src={image} alt="" width={size} height={size} className="rounded-full bg-tint-blue object-contain" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden="true" style={{ fontSize: size * 0.7 }}>{emoji}</span>
  );
}
