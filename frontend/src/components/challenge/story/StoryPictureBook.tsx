'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePopiVoice } from '@/lib/hooks/usePopiVoice';
import { useAutoNarration } from '@/lib/hooks/useAutoNarration';
import { joinSegments } from '@/lib/narration';
import { Popi } from './StoryBits';
import DefineCelebration from './DefineCelebration';
import { claimDefineBonus } from '@/lib/api/client';
import type { MissionStory } from './types';
import { btnIcon, btnPrimary, btnSecondary } from '@/components/challenge/buttons';

type Page = MissionStory['opening'][number];
type Define = NonNullable<MissionStory['define_problem']>;

interface Props {
  pages: Page[];
  /** Popi and the 5W1H questions, shown under the last picture. */
  define: Define | null;
  answers: Record<string, string>;
  onAnswer: (key: string, value: string) => void;
  /** The 5W1H questions answered so far, in order; the next one opens after each. */
  done: string[];
  onDoneChange: (done: string[]) => void;
  /** The mission, for claiming the 5W1H bonus XP. */
  challengeId: string;
  /** True once the 5W1H badge has been earned, so the celebration plays only once. */
  celebrated: boolean;
  onCelebrated: () => void;
  onDone: () => void;
}

/* The words are written over the picture rather than printed into it, so they use the app's fonts and change with
   the language. Sizes are a share of the picture's measured width, so text, badge and bubble stay in the same place
   on the picture at every screen size. Positions use left/right, not start/end: the picture does not flip in
   Persian, so neither do the things placed on it. */

const HOW_KEY = 'how';

/** The How question of a story's 5W1H, which Popi asks on step 2 (TEMP rules 22-23). */
export function howQuestion(story: MissionStory): string | null {
  return story.define_problem?.prompts.find((p) => p.key === HOW_KEY)?.question ?? null;
}

/** Everything Popi reads aloud on one picture. */
const pageWords = (p: Page) => joinSegments([p.beat, p.text, p.thought?.big, p.thought?.small]);

/** Step 1 as a picture book: one illustrated opening page at a time, with Back and Next. */
export default function StoryPictureBook({
  pages,
  define: defineAll,
  answers,
  onAnswer,
  done,
  onDoneChange,
  challengeId,
  celebrated,
  onCelebrated,
  onDone,
}: Props) {
  const t = useTranslations('story');
  const voice = usePopiVoice(useLocale());
  // The How question asks for ideas, so it waits for step 2 (TEMP rule 22).
  const define = defineAll ? { ...defineAll, prompts: defineAll.prompts.filter((p) => p.key !== HOW_KEY) } : null;
  const [index, setIndex] = useState(0);
  const page = pages[index];
  const last = index === pages.length - 1;
  // Turning the page ends the narration of the page before.
  const { stop } = voice;
  useEffect(() => stop, [index, stop]);
  // Popi reads the pages by himself, turning them, then his own message (TEMP rule 19).
  const auto = useAutoNarration({
    id: challengeId,
    voice,
    pages: pages.map(pageWords),
    onTurn: setIndex,
    finale: define?.popi,
  });
  // Each picture page starts at the top of the screen, with the picture in full view.
  useEffect(() => {
    frameRef.current?.closest('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [index]);

  // The picture's width in px; every size on it is a share of this (u(4) = 4% of the width).
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The celebration plays once, the first time every 5W1H box has an answer: when the kid
  // leaves the last box, or presses Next. XP comes from the server, once per mission.
  const [celebration, setCelebration] = useState<{ xp: number } | null>(null);
  const allAnswered = !!define && define.prompts.every((p) => done.includes(p.key));
  function maybeCelebrate(finished = allAnswered): boolean {
    if (!finished || celebrated || celebration) return false;
    setCelebration({ xp: 0 });
    onCelebrated();
    claimDefineBonus(challengeId)
      .then((r) => setCelebration((c) => (c ? { xp: r?.xp_earned ?? 0 } : c)))
      .catch(() => {});
    return true;
  }

  const u = (pct: number) => `${(width * pct) / 100}px`;

  // Load every page's picture up front, so Next shows the next one at once.
  useEffect(() => {
    pages.forEach((p) => {
      if (p.image) new Image().src = p.image;
    });
  }, [pages]);

  return (
    <div data-testid="story-picture-book" className="flex flex-col gap-4 py-4">
      <div
        ref={frameRef}
        data-testid={`story-page-${index + 1}`}
        className="relative mx-auto w-full overflow-hidden rounded-[20px] shadow-[0_6px_18px_rgba(0,0,0,0.15)]"
        // As wide as the frame, but never so tall that the picture and its buttons leave the screen.
        style={{ maxWidth: 'calc((100dvh - 380px) * 1.777)' }}
      >
        {/* width/height hold the picture's shape while it loads, so the words always have room. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- a story page sized by its own width */}
        <img
          key={page.image}
          src={page.image ?? ''}
          alt=""
          width={page.layout ? 1400 : 717}
          height={page.layout ? 788 : 430}
          className="block h-auto w-full"
        />

        {width > 0 && page.layout && (
          <div key={index} className="story-fade absolute inset-0">
            <BoxedWords page={page} layout={page.layout} u={u} />
          </div>
        )}

        {width > 0 && !page.layout && (
          <div key={index} className="story-fade absolute inset-0">
            <span
              aria-hidden="true"
              className="absolute left-[2.6%] top-[4%] flex items-center justify-center rounded-full bg-[#4A86D4] font-display text-white"
              style={{ width: u(6.4), height: u(6.4), fontSize: u(3.4) }}
            >
              {index + 1}
            </span>
            <div
              className={`absolute left-[11.4%] top-[2.5%] ${
                page.thought ? 'w-[48%]' : page.badge ? 'w-[70%]' : 'w-[56%]'
              }`}
            >
              <h2 className="font-display leading-[1.15] text-[#1B3A6B]" style={{ fontSize: u(4.4) }}>
                {page.beat}
              </h2>
              <p
                className="font-body font-semibold leading-[1.45] text-[#1B3A6B]"
                style={{
                  marginTop: u(0.6),
                  fontSize: u(page.badge ? 1.95 : 2.2),
                }}
              >
                {page.text}
              </p>
            </div>

            {page.badge && (
              <span
                className="absolute right-[1%] top-[4.6%] rounded-pill border-[#c9d6e6] bg-white/90 font-body font-semibold text-[#1B3A6B]"
                style={{
                  borderWidth: u(0.3),
                  padding: `${u(1)} ${u(2)}`,
                  fontSize: u(2.3),
                }}
              >
                🕒 {page.badge}
              </span>
            )}

            {page.thought && (
              <div className="absolute left-[58.5%] top-[19.5%] w-[23%] font-body text-[#1B3A6B]">
                <p
                  className="font-semibold leading-[1.35]"
                  style={{ fontSize: u(page.thought.big.length > 36 ? 1.9 : 2.4) }}
                >
                  {page.thought.big}
                </p>
                <p
                  className="font-medium leading-[1.35]"
                  style={{ marginTop: u(1), fontSize: u(page.thought.small.length > 40 ? 1.45 : 1.75) }}
                >
                  {page.thought.small}
                </p>
              </div>
            )}

            {/* Sized to cover the label drawn into the first picture, so only this one shows. */}
            {page.place && (
              <span
                className="absolute bottom-[3.6%] left-[2.6%] flex h-[8.8%] min-w-[17.8%] items-center justify-center rounded-pill border-white/40 bg-[#3B6FB3] font-body font-bold text-white"
                style={{
                  borderWidth: u(0.3),
                  paddingInline: u(2.4),
                  fontSize: u(2.2),
                }}
              >
                {page.place}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Back and Next sit right under the photo, above anything else on the page. */}
      {/* Three equal columns, so 🔊 sits exactly under the middle of the photo. */}
      <div className="mx-auto grid w-full grid-cols-3 items-center" style={{ maxWidth: 'calc((100dvh - 380px) * 1.777)' }}>
        {index > 0 ? (
          <button
            type="button"
            data-testid="story-page-back"
            onClick={() => setIndex((i) => i - 1)}
            className={`${btnSecondary} justify-self-start`}
          >
            {t('page_back')}
          </button>
        ) : (
          <span />
        )}
        {voice.available ? (
          <button
            type="button"
            data-testid="story-page-listen"
            aria-label={voice.speaking ? t('popi_stop') : t('listen_story')}
            onClick={() =>
              voice.speaking
                ? voice.stop()
                : voice.speak(pageWords(page))
            }
            className={`${btnIcon} justify-self-center`}
          >
            <span aria-hidden="true">{voice.speaking ? '⏹' : '🔊'}</span>
          </button>
        ) : (
          <span />
        )}
        {last && define && !allAnswered ? (
          <span />
        ) : (
        <button
          type="button"
          data-testid="story-page-next"
          onClick={() => {
            if (!last) setIndex((i) => i + 1);
            else if (!maybeCelebrate()) onDone();
          }}
          className={`${btnPrimary} justify-self-end`}
        >
          {t('page_next')}
        </button>
        )}
      </div>

      {auto.phase === 'blocked' && (
        <p
          data-testid="popi-tap-hint"
          className="story-pop self-center rounded-pill bg-white px-4 py-2 font-body text-sm font-bold text-challenge shadow-sm"
        >
          <span aria-hidden="true">👆 </span>
          {t('tap_to_listen')}
        </p>
      )}

      {last && define && (
        <DefineProblemCard
          define={define}
          answers={answers}
          onAnswer={onAnswer}
          done={done}
          onDone={(key) => {
            const next = done.includes(key) ? done : [...done, key];
            onDoneChange(next);
            if (define.prompts.every((q) => next.includes(q.key))) maybeCelebrate(true);
          }}
        />
      )}
      {celebration && (
        <DefineCelebration
          xp={celebration.xp}
          onClose={() => {
            setCelebration(null);
            onDone();
          }}
        />
      )}

    </div>
  );
}

/** Loose matching for a child's answer: case, Arabic/Persian letter forms, digits and
 *  half-spaces don't matter; any one key word is enough. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‌‏]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\s+/g, ' ')
    .trim();
}
export function answerFits(answer: string, keywords: string[]): boolean {
  const a = normalize(answer);
  if (a.length < 2) return false;
  return keywords.length === 0 || keywords.some((k) => a.includes(normalize(k)));
}

/** "The big question": Popi asks Who, What, Where, When, Why and How one at a time. Each question
 *  opens only once the one before it is answered; a miss gets Popi's hint, and a second try always
 *  goes on, so no one gets stuck. */
function DefineProblemCard({
  define,
  answers,
  onAnswer,
  done,
  onDone,
}: {
  define: Define;
  answers: Record<string, string>;
  onAnswer: (key: string, value: string) => void;
  /** Keys already answered, in order. */
  done: string[];
  onDone: (key: string) => void;
}) {
  const t = useTranslations('story');
  const [missed, setMissed] = useState<Record<string, number>>({});
  const current = define.prompts.find((p) => !done.includes(p.key)) ?? null;
  const currentIndex = current ? define.prompts.indexOf(current) : define.prompts.length;
  const locked = define.prompts.slice(currentIndex + 1);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (done.length > 0) inputRef.current?.focus();
  }, [done.length]);

  function check() {
    if (!current) return;
    const answer = answers[current.key] ?? '';
    if (answer.trim().length < 2) return;
    const tries = missed[current.key] ?? 0;
    if (answerFits(answer, current.keywords ?? []) || tries >= 1) {
      onDone(current.key);
    } else {
      setMissed((m) => ({ ...m, [current.key]: tries + 1 }));
    }
  }

  return (
    <div data-testid="define-problem" className="story-rise flex flex-col gap-4">
      <Popi text={define.popi} grand />
      <section className="rounded-[20px] border border-[#dfe8f2] bg-[#F4F8FC] p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2D6FC4] text-2xl"
          >
            💡
          </span>
          <div>
            <h2 className="font-display text-2xl text-[#1B3A6B]">{define.title}</h2>
            <p className="font-body text-base font-semibold text-[#1B3A6B]">{define.question}</p>
          </div>
        </div>
        <p className="mt-1 ps-14 font-body text-sm text-[#2D6FC4]">{define.hint}</p>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          {define.image && (
            // eslint-disable-next-line @next/next/no-img-element -- a small story photo
            <img src={define.image} alt="" className="w-full rounded-2xl sm:w-[40%]" />
          )}
          <div className="flex flex-1 flex-col gap-2" aria-live="polite">
            <p className="font-body text-xs font-bold text-[#2D6FC4]">
              {current
                ? t('define_progress', { n: currentIndex + 1, total: define.prompts.length })
                : t('define_complete')}
            </p>

            {define.prompts
              .filter((p) => done.includes(p.key))
              .map((p) => (
                <div
                  key={p.key}
                  data-testid={`define-${p.key}`}
                  data-state="done"
                  className="story-rise rounded-xl border border-[#bfe6c8] bg-[#F3FBF5] px-3 py-2"
                >
                  <p className="flex items-center gap-2 font-body text-sm font-bold text-[#1B3A6B]">
                    <span className="rounded-md bg-[#2e9e55] px-1.5 py-0.5 text-xs text-white">{p.label}</span>
                    {p.question} <span aria-hidden="true">✓</span>
                  </p>
                  <p dir="auto" className="mt-1 font-body text-sm font-semibold text-[#1d7a3a]">
                    {answers[p.key]}
                  </p>
                </div>
              ))}

            {current && (
              <div
                key={current.key}
                data-testid={`define-${current.key}`}
                data-state="current"
                className="story-rise rounded-xl border-2 border-challenge bg-white px-3 py-2.5 shadow-[0_4px_14px_rgba(45,156,219,0.18)]"
              >
                <label
                  htmlFor={`define-input-${current.key}`}
                  className="flex items-center gap-2 font-body text-sm font-bold text-[#1B3A6B]"
                >
                  <span className="rounded-md bg-[#2D6FC4] px-1.5 py-0.5 text-xs text-white">{current.label}</span>
                  {current.question}
                </label>
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    check();
                  }}
                >
                  <input
                    ref={inputRef}
                    id={`define-input-${current.key}`}
                    type="text"
                    value={answers[current.key] ?? ''}
                    onChange={(e) => onAnswer(current.key, e.target.value)}
                    placeholder={t('define_placeholder')}
                    maxLength={120}
                    dir="auto"
                    className="min-w-0 flex-1 rounded-xl border border-[#cfd8e3] px-3 py-2 font-body text-sm text-ink placeholder:text-ink/40 focus:border-challenge focus:outline-none"
                  />
                  <button
                    type="submit"
                    data-testid="define-check"
                    disabled={(answers[current.key] ?? '').trim().length < 2}
                    className={btnPrimary}
                  >
                    {t('define_check')}
                  </button>
                </form>
                {(missed[current.key] ?? 0) > 0 && current.hint && (
                  <p
                    data-testid="define-hint"
                    className="mt-2 rounded-xl bg-[#FFF7E0] px-3 py-2 font-body text-sm text-[#7a5a00]"
                  >
                    💡 {t('define_almost')} {current.hint}
                  </p>
                )}
              </div>
            )}

            {locked.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-hidden="true">
                {locked.map((p) => (
                  <span
                    key={p.key}
                    className="rounded-pill bg-[#eef2f7] px-3 py-1 font-body text-xs font-bold text-[#9aa6b4]"
                  >
                    🔒 {p.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

type Box = [number, number, number, number];
const boxStyle = ([left, top, w, h]: Box) => ({ left: `${left}%`, top: `${top}%`, width: `${w}%`, height: `${h}%` });

/** Words for a picture drawn with empty boxes for them: the beat and the line in the text box
 *  (with the thought under them when the picture has no box of its own for it), the badge in its box. */
function BoxedWords({
  page,
  layout,
  u,
}: {
  page: Page;
  layout: NonNullable<Page['layout']>;
  u: (pct: number) => string;
}) {
  const thoughtInText = page.thought && !layout.thought;
  // The words always fit their box: start at full size and step down until nothing spills over.
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const fitKey = `${page.text}|${u(1)}`;
  useLayoutEffect(() => setScale(1), [fitKey]);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (el && el.scrollHeight > el.clientHeight + 1 && scale > 0.5) setScale((v) => v * 0.92);
  }, [scale, fitKey]);
  const textSize = 1.85 * scale;
  return (
    <>
      <div
        ref={boxRef}
        className="absolute flex flex-col justify-center overflow-hidden text-[#1B3A6B]"
        style={{ ...boxStyle(layout.text as Box), padding: `${u(0.8)} ${u(2.2)}` }}
      >
        <h2 className="font-display leading-[1.1]" style={{ fontSize: u(3.2 * Math.max(scale, 0.75)) }}>
          {page.beat}
        </h2>
        <p className="font-body font-semibold leading-[1.35]" style={{ marginTop: u(0.3), fontSize: u(textSize) }}>
          {page.text}
          {thoughtInText && (
            <>
              {' '}
              <span className="italic">
                “{page.thought!.big} {page.thought!.small}”
              </span>
            </>
          )}
        </p>
      </div>

      {page.badge && layout.badge && (
        <span
          className="absolute flex items-center font-body font-bold text-[#1B3A6B]"
          style={{ ...boxStyle(layout.badge as Box), fontSize: u(2.1) }}
        >
          {page.badge}
        </span>
      )}

      {page.thought && layout.thought && (
        <div
          className="absolute flex flex-col justify-center font-body text-[#1B3A6B]"
          style={boxStyle(layout.thought as Box)}
        >
          <p className="font-semibold leading-[1.35]" style={{ fontSize: u(1.9) }}>
            {page.thought.big}
          </p>
          <p className="font-medium leading-[1.35]" style={{ marginTop: u(0.6), fontSize: u(1.5) }}>
            {page.thought.small}
          </p>
        </div>
      )}
    </>
  );
}
