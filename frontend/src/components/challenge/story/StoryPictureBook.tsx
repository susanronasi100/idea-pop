'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Popi } from './StoryBits';
import DefineCelebration from './DefineCelebration';
import { claimDefineBonus } from '@/lib/api/client';
import type { MissionStory } from './types';

type Page = MissionStory['opening'][number];
type Define = NonNullable<MissionStory['define_problem']>;

interface Props {
  pages: Page[];
  /** Popi and the 5W1H questions, shown under the last picture. */
  define: Define | null;
  answers: Record<string, string>;
  onAnswer: (key: string, value: string) => void;
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

/** Step 1 as a picture book: one illustrated opening page at a time, with Back and Next. */
export default function StoryPictureBook({
  pages,
  define,
  answers,
  onAnswer,
  challengeId,
  celebrated,
  onCelebrated,
  onDone,
}: Props) {
  const t = useTranslations('story');
  const [index, setIndex] = useState(0);
  const page = pages[index];
  const last = index === pages.length - 1;

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
  const allAnswered = !!define && define.prompts.every((p) => (answers[p.key] ?? '').trim().length >= 2);
  function maybeCelebrate(): boolean {
    if (!allAnswered || celebrated || celebration) return false;
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
        className="relative overflow-hidden rounded-[20px] shadow-[0_6px_18px_rgba(0,0,0,0.15)]"
      >
        {/* width/height hold the picture's shape while it loads, so the words always have room. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- a story page sized by its own width */}
        <img key={page.image} src={page.image ?? ''} alt="" width={717} height={430} className="block h-auto w-full" />

        {width > 0 && (
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

      {last && define && (
        <DefineProblemCard define={define} answers={answers} onAnswer={onAnswer} onLeave={maybeCelebrate} />
      )}
      {celebration && <DefineCelebration xp={celebration.xp} onClose={() => setCelebration(null)} />}

      <div className="flex items-center justify-between">
        {index > 0 ? (
          <button
            type="button"
            data-testid="story-page-back"
            onClick={() => setIndex((i) => i - 1)}
            className="rounded-pill border-2 border-challenge bg-white px-5 py-2 font-body text-sm font-bold text-challenge transition-all hover:bg-challenge/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2"
          >
            {t('page_back')}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          data-testid="story-page-next"
          onClick={() => {
            if (!last) setIndex((i) => i + 1);
            else if (!maybeCelebrate()) onDone();
          }}
          className="rounded-pill bg-challenge px-5 py-2 font-body text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2"
        >
          {t('page_next')}
        </button>
      </div>
    </div>
  );
}

/** "The big question": Popi asks the kid to pin the problem down with Who, What, Where, When, Why and How. */
function DefineProblemCard({
  define,
  answers,
  onAnswer,
  onLeave,
}: {
  define: Define;
  answers: Record<string, string>;
  onAnswer: (key: string, value: string) => void;
  /** Called when the kid leaves a box, to check whether every box is now answered. */
  onLeave: () => void;
}) {
  return (
    <div data-testid="define-problem" className="story-rise flex flex-col gap-4">
      <Popi text={define.popi} />
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
          <div className="flex flex-1 flex-col gap-2">
            {define.prompts.map((p) => (
              <label
                key={p.key}
                data-testid={`define-${p.key}`}
                className="flex flex-col gap-1 rounded-xl border border-[#e3e9f1] bg-white px-3 py-2"
              >
                <span className="flex items-center gap-2 font-body text-sm font-bold text-[#1B3A6B]">
                  <span className="rounded-md bg-[#2D6FC4] px-1.5 py-0.5 text-xs text-white">{p.label}</span>
                  {p.question}
                </span>
                <input
                  type="text"
                  value={answers[p.key] ?? ''}
                  onChange={(e) => onAnswer(p.key, e.target.value)}
                  onBlur={onLeave}
                  placeholder={p.example}
                  maxLength={120}
                  dir="auto"
                  className="border-b border-dashed border-[#cfd8e3] bg-transparent pb-1 font-body text-sm text-ink placeholder:text-ink/40 focus:border-challenge focus:outline-none"
                />
              </label>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
