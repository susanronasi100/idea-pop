'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Character3D, Popi, RewardPop, StepNav, pillCtaClass } from './StoryBits';
import { btnPrimary, btnText } from '@/components/challenge/buttons';
import type { MissionStory } from './types';
import type { BadgeKey, MissionGame, GameUpdate } from './useMissionGame';

interface Props {
  story: MissionStory;
  game: MissionGame;
  update: GameUpdate;
  award: (b: BadgeKey) => void;
  onNext: () => void;
  onBack: () => void;
  /** The first few challenges show the full "what does inspired mean?" tip; later ones a small one. */
  fullInspirationTip?: boolean;
}

/** The three "think like your partner" questions, asked one at a time. */
const PARTNER_QUESTIONS = ['what', 'how', 'inspired'] as const;
type PartnerQuestion = (typeof PARTNER_QUESTIONS)[number];

/**
 * Step 3, Nature clues, in four parts (TEMP rule 37):
 * 1. Meet the heroes: turn every card (photo → trick → what it does). All met → Clue Detective badge.
 * 2. Pick your nature partner: the hero the kid likes best to help solve the problem.
 * 3. Think like your partner: what does it do, how, and how could we be inspired by it.
 * 4. What "inspired" means: take the trick, not the animal (in full on the first challenges).
 * We never suggest an answer: "peek at the card" only repeats what the card said.
 */
export default function StoryClues({ story, game, update, award, onNext, onBack, fullInspirationTip = true }: Props) {
  const t = useTranslations('story');
  // Which cards show their words right now; a card can be turned back to its photo.
  const [turned, setTurned] = useState<number[]>([]);
  const cards = story.clue_cards;
  const allOpen = cards.every((_, i) => game.flipped.includes(i));
  const partner = game.partner !== null && game.partner !== undefined ? cards[game.partner] : null;
  const answered = PARTNER_QUESTIONS.filter((k) => game.partnerDone.includes(k));
  const allAnswered = answered.length === PARTNER_QUESTIONS.length;
  const current = PARTNER_QUESTIONS.find((k) => !game.partnerDone.includes(k)) ?? null;

  function flip(i: number) {
    if (!game.flipped.includes(i)) {
      const flipped = [...game.flipped, i];
      update({ flipped });
      // Meeting every nature hero earns the Clue Detective badge.
      if (cards.every((_, k) => flipped.includes(k))) award('clue');
    }
    setTurned((v) => (v.includes(i) ? v.filter((x) => x !== i) : [...v, i]));
  }

  function choosePartner(i: number) {
    // Changing partner starts the three questions again, about the new one.
    if (game.partner === i) return;
    update({ partner: i, partnerAnswers: {}, partnerDone: [] });
  }

  const question = (k: PartnerQuestion) =>
    t(`partner_q_${k}`, { name: partner?.name ?? '', hero: story.hero.name });

  return (
    <div data-testid="story-clues" className="flex flex-col gap-6 py-4">
      <Popi text={story.guide.nature_clues} />

      {/* ── Part 1: meet the heroes ── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl text-challenge">{story.function_question}</h2>
        <Meter label={t('heroes_met')} value={game.flipped.length} total={cards.length} />

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
                  {/* Back: the words. */}
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
        {allOpen && <RewardPop text={t('badge_earned', { badge: t('badge_clue') })} />}
      </section>

      {/* ── Part 2: pick your nature partner ── */}
      {allOpen && (
        <section data-testid="pick-partner" className="story-rise flex flex-col gap-3">
          <Popi text={t('partner_pick_popi', { hero: story.hero.name })} />
          <h2 className="font-display text-2xl text-challenge">{t('partner_pick_title')}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label={t('partner_pick_title')}>
            {cards.map((c, i) => {
              const on = game.partner === i;
              return (
                <button
                  key={c.name}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-testid={`partner-${i}`}
                  onClick={() => choosePartner(i)}
                  className={[
                    'flex flex-col items-center gap-1 rounded-[18px] border-2 bg-white p-3 text-center transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0F3F63]',
                    on ? 'scale-[1.03] border-[#1A6FA6] bg-[#EAF5FC] shadow-[0_0_0_4px_#CDE7F7]' : 'border-[#D6E4EE] hover:border-[#58C6EE]',
                  ].join(' ')}
                >
                  <Character3D src={c.image} emoji={c.emoji} alt="" size={96} />
                  <span className="font-body text-base font-extrabold text-ink">{c.name}</span>
                  {on && (
                    <span className="rounded-pill bg-[#1A6FA6] px-2.5 py-0.5 font-body text-xs font-bold text-white">
                      ⭐ {t('partner_chip')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Part 3: think like your partner ── */}
      {partner && (
        <section data-testid="partner-questions" className="story-rise flex flex-col gap-3 rounded-[20px] bg-white p-5 shadow-sm">
          <h2 className="font-display text-2xl text-challenge">{t('partner_think_title', { name: partner.name })}</h2>
          <Meter label={t('inspiration_meter')} value={answered.length} total={PARTNER_QUESTIONS.length} icon="⚡" />

          {PARTNER_QUESTIONS.filter((k) => game.partnerDone.includes(k)).map((k) => (
            <div key={k} data-testid={`partner-q-${k}`} data-state="done" className="rounded-xl border border-[#BFE6C8] bg-[#F3FBF5] px-4 py-3">
              <p className="font-body text-base font-bold text-ink">
                {question(k)} <span aria-hidden="true">✓</span>
              </p>
              <p dir="auto" className="mt-1 font-body text-base font-semibold text-[#1d7a3a]">
                {game.partnerAnswers[k]}
              </p>
            </div>
          ))}

          {current && (
            <PartnerQuestionBox
              key={`${game.partner}-${current}`}
              id={current}
              question={question(current)}
              value={game.partnerAnswers[current] ?? ''}
              onChange={(v) => update((g) => ({ partnerAnswers: { ...g.partnerAnswers, [current]: v } }))}
              onDone={() => update((g) => ({ partnerDone: [...g.partnerDone, current] }))}
              peek={`${partner.trick} ${partner.does}`}
            />
          )}

          {allAnswered && <RewardPop text={t('inspiration_unlocked')} />}
        </section>
      )}

      {/* ── Part 4: what "inspired" means ── */}
      {partner && allAnswered && (
        <section data-testid="inspiration-tip" className="story-rise flex flex-col gap-3">
          {fullInspirationTip ? (
            <div className="flex flex-col gap-3 rounded-[20px] bg-gradient-to-br from-[#FFF7D6] to-[#FFE9A8] p-5">
              <p className="font-display text-2xl leading-snug text-ink">“{t('inspired_quote')}”</p>
              <p className="font-body text-sm font-bold text-[#7A5A00]">{t('inspired_quote_by')}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3">
                  <p className="font-body text-xs font-extrabold uppercase tracking-wide text-[#1E7A44]">
                    {t('inspired_trick', { name: partner.name })}
                  </p>
                  <p className="mt-1 font-body text-base font-medium text-ink">{partner.trick}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="font-body text-xs font-extrabold uppercase tracking-wide text-[#1A6FA6]">{t('inspired_yours')}</p>
                  <p dir="auto" className="mt-1 font-body text-base font-medium text-ink">{game.partnerAnswers.inspired}</p>
                </div>
              </div>
            </div>
          ) : (
            <details className="rounded-[16px] bg-[#FFF7D6] px-4 py-3">
              <summary className="cursor-pointer font-body text-base font-bold text-[#7A5A00]">💡 {t('inspired_tip_small')}</summary>
              <p className="mt-2 font-body text-base font-medium text-ink">“{t('inspired_quote')}”</p>
            </details>
          )}
        </section>
      )}

      <StepNav onBack={onBack} backLabel={t('back')}>
        <button type="button" data-testid="clues-next" onClick={onNext} disabled={!allAnswered} className={pillCtaClass}>
          {t('clues_next')}
        </button>
      </StepNav>
    </div>
  );
}

/** A progress meter that fills as the kid goes (heroes met, inspiration). */
function Meter({ label, value, total, icon = '🏅' }: { label: string; value: number; total: number; icon?: string }) {
  const shown = Math.min(value, total);
  const pct = total > 0 ? Math.round((shown / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 font-body text-sm font-extrabold text-[#1E7A44]">
      <span>{label}</span>
      <span
        className="h-3 flex-1 overflow-hidden rounded-pill bg-[#E3EEF5]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={shown}
        aria-label={label}
      >
        <span
          className="block h-full rounded-pill bg-gradient-to-r from-[#D1EF5A] to-[#9ED34A] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span dir="ltr">
        {shown}/{total} {shown >= total ? icon : ''}
      </span>
    </div>
  );
}

/** One "think like your partner" question: type, check, or peek at the partner's card. */
function PartnerQuestionBox({
  id,
  question,
  value,
  onChange,
  onDone,
  peek,
}: {
  id: PartnerQuestion;
  question: string;
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
  peek: string;
}) {
  const t = useTranslations('story');
  const [peeking, setPeeking] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);
  const ready = value.trim().length >= 3;
  return (
    <form
      data-testid={`partner-q-${id}`}
      data-state="current"
      className="story-rise flex flex-col gap-2 rounded-xl border-2 border-[#1A6FA6] bg-white p-4 shadow-[0_4px_14px_rgba(45,156,219,0.18)]"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onDone();
      }}
    >
      <label htmlFor={`partner-input-${id}`} className="font-body text-base font-bold text-ink">
        {question}
      </label>
      <textarea
        autoComplete="off"
        ref={inputRef}
        id={`partner-input-${id}`}
        rows={2}
        maxLength={240}
        dir="auto"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('partner_placeholder')}
        className="min-w-0 resize-none rounded-lg border border-[#8FA3B8] px-3 py-2 font-body text-base text-ink placeholder:text-ink/40 focus:border-challenge focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" data-testid="partner-check" disabled={!ready} className={btnPrimary}>
          {t('define_check')}
        </button>
        <button type="button" data-testid="partner-peek" onClick={() => setPeeking((v) => !v)} className={btnText}>
          {t('partner_peek')}
        </button>
      </div>
      {peeking && (
        <p data-testid="partner-peek-text" className="rounded-xl bg-[#FFF7E0] px-3 py-2 font-body text-base text-[#5a4300]">
          💡 {peek}
        </p>
      )}
    </form>
  );
}
