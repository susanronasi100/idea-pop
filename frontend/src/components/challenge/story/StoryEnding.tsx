'use client';

import { useTranslations } from 'next-intl';
import { SceneStage, Confetti, Popi, optionClass } from './StoryBits';
import type { MissionStory } from './types';
import type { BadgeKey, MissionGame } from './useMissionGame';

interface Props {
  story: MissionStory;
  game: MissionGame;
  update: (patch: Partial<MissionGame>) => void;
}

const BADGES: BadgeKey[] = ['define', 'clue', 'tool', 'retry'];

/** Story top for step 8 — "And ever since then…": the hero in the scene,
 *  confetti, the mission sticker, the bonus badges and a one-tap reflection.
 *  The existing celebrate step (XP summary + Ideas Wall) sits below it. */
export default function StoryEnding({ story, game, update }: Props) {
  const t = useTranslations('story');
  return (
    <div data-testid="story-ending" className="flex flex-col gap-5 pt-4">
      <Confetti />

      <SceneStage story={story} alt={t('hero_alt', { name: story.hero.name, role: story.hero.role })} align="end" />

      <Popi label={t('popi_ending')} text={story.guide.ending} />

      <div className="flex flex-col items-center gap-3 rounded-card bg-white p-5 text-center">
        <span
          data-testid="story-sticker"
          aria-hidden="true"
          className="story-stick flex h-28 w-28 items-center justify-center rounded-full border-[6px] border-white bg-[radial-gradient(circle_at_35%_30%,#fff,#ffe38a_40%,#f2b705)] text-5xl shadow-[0_6px_18px_rgba(0,0,0,0.18)]"
        >
          {story.sticker.emoji}
        </span>
        <p className="font-display text-xl text-ink">{t('sticker_earned', { name: story.sticker.name })}</p>
        <ul className="flex flex-wrap justify-center gap-2" aria-label={t('badges_aria')}>
          {BADGES.map((b) => {
            const got = game.badges.includes(b);
            const name = b === 'tool' ? story.tool.badge : t(`badge_${b}`);
            return (
              <li
                key={b}
                data-testid={`badge-${b}`}
                data-earned={got}
                className={`rounded-pill px-3 py-1.5 font-body text-sm font-bold ${got ? 'bg-[#fff5d1] text-[#6b4d00]' : 'bg-ink/10 text-ink/60'}`}
              >
                {t(`badge_icon_${b}`)} {name} {got ? '' : '🔒'}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-3 rounded-card bg-white p-5">
        <p className="font-display text-2xl text-challenge">{t('tell_your_part')}</p>
        <p className="font-body text-sm font-semibold text-ink">{story.reflection.question}</p>
        <div className="flex flex-wrap gap-2">
          {story.reflection.options.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={game.reflection === o}
              onClick={() => update({ reflection: o })}
              className={`flex flex-1 basis-36 flex-col items-center gap-2 ${optionClass(game.reflection === o ? 'picked' : 'idle')}`}
            >
              {/* The nature hero's photo instead of its emoji, when the mission has one. */}
              {(() => {
                const hero = heroFor(o, story);
                return hero?.image ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a small transparent cut-out */}
                    <img src={hero.image} alt="" width={80} height={80} className="h-20 w-20 object-contain" />
                    <span className="text-base font-bold">{withoutEmoji(o)}</span>
                  </>
                ) : (
                  o
                );
              })()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** An answer such as "🦟 Water strider" without its leading emoji. */
function withoutEmoji(option: string): string {
  return option.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

/** The nature hero an answer names ("Water lily" matches "Giant water lily"). */
function heroFor(option: string, story: MissionStory) {
  const name = withoutEmoji(option).toLowerCase();
  return story.clue_cards.find((c) => {
    const card = c.name.toLowerCase();
    return card.includes(name) || name.includes(card);
  });
}
