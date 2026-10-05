'use client';

import { useTranslations } from 'next-intl';
import { Character3D, Popi, RewardPop, optionClass } from './StoryBits';
import type { MissionStory } from './types';
import type { MissionGame, GameUpdate } from './useMissionGame';
import { btnIcon } from '@/components/challenge/buttons';


/** Story top for step 6: chapter, Popi, the starred tool idea as a reminder
 *  and the engineer's checklist. The existing sketch capture sits below. */
export function StorySketchTop({ story, game, update }: { story: MissionStory; game: MissionGame; update: GameUpdate }) {
  const t = useTranslations('story');
  const fav = game.favourite ? story.tool.parts.find((p) => p.key === game.favourite) : null;
  const favText = fav ? game.toolAnswers[fav.key] : null;
  return (
    <div data-testid="story-sketch" className="flex flex-col gap-4 pt-4">
      <Popi text={story.guide.sketch} />
      {favText && (
        <p className="rounded-2xl bg-[#fff5d1] px-4 py-2.5 font-body text-sm font-semibold text-ink">
          ⭐ {t('your_favourite', { idea: favText })}
        </p>
      )}
      <fieldset className="flex flex-col gap-2 rounded-card bg-white p-4">
        <legend className="sr-only">{t('checklist_title')}</legend>
        <p aria-hidden="true" className="font-body font-bold text-sm text-ink">{t('checklist_title')}</p>
        {story.sketch_checklist.map((item, i) => {
          const on = game.sketchChecks.includes(i);
          return (
            <label key={item} className="flex cursor-pointer items-center gap-3 rounded-xl bg-tint-blue px-3 py-2.5 font-body text-sm font-semibold text-ink">
              <input
                type="checkbox"
                data-testid={`sketch-check-${i}`}
                checked={on}
                onChange={() =>
                  update((g) => ({
                    sketchChecks: on ? g.sketchChecks.filter((x) => x !== i) : [...g.sketchChecks, i],
                  }))
                }
                className="h-5 w-5 accent-explore"
              />
              {item}
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}

function Counter({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  testId: string;
}) {
  const t = useTranslations('story');
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid={`${testId}-minus`}
        aria-label={t('one_less')}
        onClick={() => onChange(Math.max(0, value - 1))}
        className={`${btnIcon} text-xl`}
      >
        −
      </button>
      <output data-testid={testId} aria-live="polite" className="min-w-12 text-center font-display text-3xl tabular-nums">{value}</output>
      <button
        type="button"
        data-testid={`${testId}-plus`}
        aria-label={t('one_more')}
        onClick={() => onChange(Math.min(999, value + 1))}
        className={`${btnIcon} text-xl`}
      >
        +
      </button>
      <span className="font-body text-xs text-ink/60">{label}</span>
    </div>
  );
}

/** Did round 2 beat round 1? */
export function improved(r1: number, r2: number, higherIsBetter: boolean): boolean {
  if (r1 <= 0 || r2 <= 0) return false;
  return higherIsBetter ? r2 > r1 : r2 < r1;
}

/**
 * Story top for step 7: the two-round fair test. Round 1 + a quick check,
 * Popi's "change ONE thing" nudge, round 2, and a bar chart of the two.
 * Beating round 1 earns the Second Try Hero badge.
 */
export function StoryFairTest({
  story,
  game,
  update,
}: {
  story: MissionStory;
  game: MissionGame;
  update: GameUpdate;
}) {
  const t = useTranslations('story');
  const test = story.test;
  const max = Math.max(game.round1, game.round2, 1);
  const better = improved(game.round1, game.round2, test.higher_is_better);

  function setRound(key: 'round1' | 'round2', n: number) {
    update((g) => {
      const next = { ...g, [key]: n };
      const won = improved(next.round1, next.round2, test.higher_is_better);
      return { [key]: n, badges: won && !g.badges.includes('retry') ? [...g.badges, 'retry' as const] : g.badges };
    });
  }

  return (
    <div data-testid="story-fair-test" className="flex flex-col gap-4 pt-4">
      <div className="flex items-end gap-2">
        <Character3D src={story.hero.image} emoji={story.hero.emoji} alt={story.hero.name} size={92} className="hidden shrink-0 sm:inline-flex" />
        <div className="flex-1"><Popi text={story.guide.build_and_test} /></div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-card bg-tint-cream p-4">
          <p className="font-body font-bold text-base text-ink">{t('round', { n: 1 })}</p>
          <Counter label={test.measure} value={game.round1} onChange={(n) => setRound('round1', n)} testId="round1" />
          <p className="font-body text-sm font-semibold text-ink">{test.check_question}</p>
          <div className="flex flex-wrap gap-2">
            {test.check_options.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={game.check === o}
                onClick={() => update({ check: o })}
                className={`flex-1 basis-24 !px-3 !py-2 text-xs ${optionClass(game.check === o ? 'picked' : 'idle')}`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-card bg-tint-lime p-4">
          <p className="font-body font-bold text-base text-ink">{t('round', { n: 2 })}</p>
          <Counter label={test.measure} value={game.round2} onChange={(n) => setRound('round2', n)} testId="round2" />
          <label htmlFor="story-change" className="font-body text-sm font-semibold text-ink">{test.change_prompt}</label>
          <input
            id="story-change"
            data-testid="round-change"
            type="text"
            maxLength={120}
            value={game.change}
            onChange={(e) => update({ change: e.target.value })}
            placeholder={t('change_placeholder')}
            className="rounded-xl border-2 border-ink/10 bg-white px-3 py-2 font-body text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge"
          />
        </div>
      </div>

      <Popi label={t('popi_tip')} text={story.guide.retry_tip} />

      <figure className="rounded-card bg-white p-4">
        <figcaption className="mb-2 font-body text-xs font-bold uppercase tracking-wide text-ink/60">
          {t('chart_caption', { measure: test.measure })}
        </figcaption>
        <div className="flex h-36 items-end gap-6 border-b-2 border-ink/20 px-3">
          {[game.round1, game.round2].map((v, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <b className="font-body text-sm tabular-nums">{v}</b>
              <i
                className={`block w-full max-w-[90px] rounded-t-lg transition-all duration-500 ${i === 0 ? 'bg-ink/20' : 'bg-challenge'}`}
                style={{ height: `${(v / max) * 100}px` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-6 px-3 font-body text-xs font-semibold text-ink/60">
          <span className="flex-1 text-center">{t('round', { n: 1 })}</span>
          <span className="flex-1 text-center">{t('round', { n: 2 })}</span>
        </div>
      </figure>
      {better && <RewardPop text={t('badge_earned', { badge: t('badge_retry') })} />}
    </div>
  );
}
