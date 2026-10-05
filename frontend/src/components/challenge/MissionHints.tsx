'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { btnSecondary } from '@/components/challenge/buttons';

interface MissionHintsProps {
  /** Ordered nudges; the LAST entry is the big give-away hint. */
  hints: string[];
}

/**
 * "Need a hint?" — a safe, no-LLM helper. Hints reveal one at a time so kids
 * get the smallest nudge first; the final click reveals the give-away.
 * Same accordion anatomy as the thinking-tools selector.
 */
export default function MissionHints({ hints }: MissionHintsProps) {
  const t = useTranslations('hints');
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(0);

  if (!hints || hints.length === 0) return null;

  const allShown = shown >= hints.length;
  const nextIsLast = shown === hints.length - 1;
  const revealLabel = shown === 0 ? t('show_first') : nextIsLast ? t('show_last') : t('show_next');

  return (
    <div data-testid="mission-hints" className="overflow-hidden rounded-card border border-ink/20">
      <button
        type="button"
        data-testid="hints-toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between bg-tint-cream px-4 py-3 font-body font-bold text-sm text-ink transition-colors hover:bg-tint-cream/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/40"
      >
        <span>{t('toggle')}</span>
        <span
          className="text-ink/50 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 bg-white px-4 py-4">
          <p className="font-body text-sm text-ink/60">{t('intro')}</p>

          {hints.slice(0, shown).map((hint, i) => {
            const isBig = i === hints.length - 1;
            return (
              <div
                key={i}
                data-testid={`hint-item-${i}`}
                className={`rounded-card p-3 ${isBig ? 'bg-tint-blush' : 'bg-tint-cream'}`}
              >
                <p className="font-body text-xs font-bold text-ink/60">
                  {isBig ? t('big_hint_label') : t('hint_label', { number: i + 1 })}
                </p>
                <p className="mt-1 font-body text-sm text-ink">{hint}</p>
              </div>
            );
          })}

          {allShown ? (
            <p data-testid="hints-done" className="font-body text-sm font-semibold text-ink/70">
              {t('all_shown')}
            </p>
          ) : (
            <button
              type="button"
              data-testid="hint-reveal-btn"
              onClick={() => setShown((prev) => prev + 1)}
              className={`${btnSecondary} self-start`}
            >
              {revealLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
