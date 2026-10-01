"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { MissionStory } from "./types";

type Page = MissionStory["opening"][number];

interface Props {
  pages: Page[];
  onDone: () => void;
}

/* The words are written over the picture rather than printed into it, so they use the app's fonts and change with
   the language. Sizes are a share of the picture's measured width, so text, badge and bubble stay in the same place
   on the picture at every screen size. Positions use left/right, not start/end: the picture does not flip in
   Persian, so neither do the things placed on it. */

/** Step 1 as a picture book: one illustrated opening page at a time, with Back and Next. */
export default function StoryPictureBook({ pages, onDone }: Props) {
  const t = useTranslations("story");
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
    const ro = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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
        <img
          key={page.image}
          src={page.image ?? ""}
          alt=""
          width={717}
          height={430}
          className="block h-auto w-full"
        />

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
                page.thought ? "w-[48%]" : page.badge ? "w-[70%]" : "w-[56%]"
              }`}
            >
              <h2
                className="font-display leading-[1.15] text-[#1B3A6B]"
                style={{ fontSize: u(4.4) }}
              >
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
                  style={{ fontSize: u(2.4) }}
                >
                  {page.thought.big}
                </p>
                <p
                  className="font-medium leading-[1.35]"
                  style={{ marginTop: u(1), fontSize: u(1.75) }}
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

      <div className="flex items-center justify-between">
        {index > 0 ? (
          <button
            type="button"
            data-testid="story-page-back"
            onClick={() => setIndex((i) => i - 1)}
            className="rounded-pill border-2 border-challenge bg-white px-5 py-2 font-body text-sm font-bold text-challenge transition-all hover:bg-challenge/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2"
          >
            {t("page_back")}
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
          {t("page_next")}
        </button>
      </div>
    </div>
  );
}
