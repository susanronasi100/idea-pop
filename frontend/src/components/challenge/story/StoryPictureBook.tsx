'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MissionStory } from './types';

type Page = MissionStory['opening'][number];

interface Props {
  pages: Page[];
  onDone: () => void;
}

/* The words are written over the picture rather than printed into it, so they use the app's fonts and change with
   the language. Sizes are in cqw (a share of the picture's width), so text, badge and bubble stay in the same place
   on the picture at every screen size. Positions use left/right, not start/end: the picture does not flip in
   Persian, so neither do the things placed on it. */
const numClass =
  'absolute left-[2.6%] top-[4%] flex h-[6.4cqw] w-[6.4cqw] items-center justify-center rounded-full bg-[#4A86D4] font-display text-[3.4cqw] text-white';
const pillClass =
  'rounded-pill border-[0.3cqw] border-white/40 bg-[#3B6FB3] font-body font-bold text-white';

/** Step 1 as a picture book: one illustrated opening page at a time, with Back and Next. */
export default function StoryPictureBook({ pages, onDone }: Props) {
  const t = useTranslations('story');
  const [index, setIndex] = useState(0);
  const page = pages[index];
  const last = index === pages.length - 1;

  return (
    <div data-testid="story-picture-book" className="flex flex-col gap-4 py-4">
      <div
        key={index}
        data-testid={`story-page-${index + 1}`}
        className="story-rise relative overflow-hidden rounded-[20px] shadow-[0_6px_18px_rgba(0,0,0,0.15)] [container-type:inline-size]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a story page sized by its own width */}
        <img src={page.image ?? ''} alt="" className="block w-full" />

        <span aria-hidden="true" className={numClass}>
          {index + 1}
        </span>
        <div
          className={`absolute left-[11.4%] top-[2.5%] ${
            page.thought ? 'w-[48%]' : page.badge ? 'w-[70%]' : 'w-[56%]'
          }`}
        >
          <h2 className="font-display text-[4.4cqw] leading-[1.15] text-[#1B3A6B]">{page.beat}</h2>
          <p
            className={`mt-[0.6cqw] font-body font-semibold leading-[1.45] text-[#1B3A6B] ${
              page.badge ? 'text-[1.95cqw]' : 'text-[2.2cqw]'
            }`}
          >
            {page.text}
          </p>
        </div>

        {page.badge && (
          <span
            className="absolute right-[1%] top-[4.6%] rounded-pill border-[0.3cqw] border-[#c9d6e6] bg-white/90 px-[2cqw] py-[1cqw] font-body text-[2.3cqw] font-semibold text-[#1B3A6B]"
          >
            🕒 {page.badge}
          </span>
        )}

        {page.thought && (
          <div className="absolute left-[58.5%] top-[19.5%] w-[23%] font-body text-[#1B3A6B]">
            <p className="text-[2.4cqw] font-semibold leading-[1.35]">{page.thought.big}</p>
            <p className="mt-[1cqw] text-[1.75cqw] font-medium leading-[1.35]">{page.thought.small}</p>
          </div>
        )}

        {/* Sized to cover the label drawn into the first picture, so only this one shows. */}
        {page.place && (
          <span
            className={`absolute bottom-[3.6%] left-[2.6%] flex h-[8.8%] min-w-[17.8%] items-center justify-center px-[2.4cqw] text-[2.2cqw] ${pillClass}`}
          >
            {page.place}
          </span>
        )}
      </div>

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
          onClick={() => (last ? onDone() : setIndex((i) => i + 1))}
          className="rounded-pill bg-challenge px-5 py-2 font-body text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2"
        >
          {t('page_next')}
        </button>
      </div>
    </div>
  );
}
