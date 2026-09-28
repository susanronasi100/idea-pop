'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { fetchKidProgress } from '@/lib/api/client';
import { levelProgress } from '@/lib/progress';

interface XpInfoDialogProps {
  /** XP this mission gives when it is finished. */
  missionXp: number;
  onClose: () => void;
}

interface MyXp {
  xp: number;
  level: number;
  rank: string;
}

// Canonical XP amounts (CLAUDE.md "Gamification").
const EARN_ROWS = [
  { key: 'explore', xp: 5, emoji: '🎬' },
  { key: 'learn', xp: 10, emoji: '📚' },
  { key: 'solve', xp: 20, emoji: '🏆' },
  { key: 'cycle', xp: 15, emoji: '🔄' },
] as const;

/** The "What is XP?" panel. It drops down from the mission's top bar, like
 *  the mission menu, when the kid taps the XP badge. */
export default function XpInfoDialog({ missionXp, onClose }: XpInfoDialogProps) {
  const t = useTranslations('challenge');
  const [mine, setMine] = useState<MyXp | null | 'loading'>('loading');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    fetchKidProgress()
      .then((p) => {
        if (!alive) return;
        setMine(p ? { xp: p.xp_total, level: p.level, rank: p.rank } : null);
      })
      .catch(() => alive && setMine(null));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lp = mine && mine !== 'loading' ? levelProgress(mine.xp, mine.level) : null;

  return (
    <>
      {/* Invisible backdrop: a tap anywhere else closes the panel. */}
      <div className="fixed inset-0 z-40" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-labelledby="xp-info-title"
        data-testid="xp-info"
        className="absolute left-0 right-0 top-full z-50 max-h-[75vh] overflow-y-auto rounded-b-xl border-t border-ink/10 bg-white shadow-xl"
      >
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 id="xp-info-title" className="font-display text-lg text-challenge">
              ⭐ {t('xp_info_title')}
            </h2>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={t('xp_info_close')}
              className="rounded-lg p-1 text-ink/50 hover:bg-tint-blue hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-4 px-5 pb-5 pt-2 font-body text-sm text-ink">
            {/* 1. What XP means */}
            <p>{t('xp_info_what')}</p>

            {/* 4. This mission */}
            <div
              dir="auto"
              className="flex items-center gap-3 rounded-card bg-challenge/10 p-3"
              data-testid="xp-info-mission"
            >
              <span className="text-2xl" aria-hidden="true">🎯</span>
              <p className="font-semibold">{t('xp_info_mission', { xp: missionXp })}</p>
            </div>

            {/* 3. The kid's XP right now */}
            {mine === 'loading' ? (
              <p className="text-ink/50">{t('xp_info_loading')}</p>
            ) : mine && lp ? (
              <div className="flex flex-col gap-2 rounded-card border border-ink/10 p-3" data-testid="xp-info-mine">
                <p className="font-semibold">
                  {t('xp_info_mine', { xp: mine.xp, level: mine.level, rank: mine.rank })}
                </p>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full bg-ink/10"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={lp.pct}
                >
                  <div className="h-full rounded-full bg-challenge" style={{ width: `${lp.pct}%` }} />
                </div>
                <p className="text-xs text-ink/60">
                  {lp.isMax
                    ? t('xp_info_max_level')
                    : t('xp_info_next_level', { xp: lp.remaining, level: lp.nextLevel })}
                </p>
              </div>
            ) : null}

            {/* 2. How XP is counted */}
            <div className="flex flex-col gap-1.5">
              <p className="font-display text-sm text-ink">{t('xp_info_how_title')}</p>
              <ul className="flex flex-col gap-1.5">
                {EARN_ROWS.map((row) => (
                  <li key={row.key} className="flex items-center gap-2">
                    <span aria-hidden="true">{row.emoji}</span>
                    <span className="flex-1">{t(`xp_info_earn_${row.key}`)}</span>
                    <span dir="ltr" className="rounded-pill bg-challenge/10 px-2 py-0.5 text-xs font-semibold text-challenge">
                      +{row.xp} XP
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 5. Other essentials */}
            <ul className="flex list-disc flex-col gap-1 ps-5 text-xs text-ink/70">
              <li>{t('xp_info_levels')}</li>
              <li>{t('xp_info_keep')}</li>
              <li>{t('xp_info_once')}</li>
            </ul>

            <button
              type="button"
              onClick={onClose}
              className="rounded-pill bg-challenge py-2.5 font-display text-sm text-white hover:bg-challenge/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2"
            >
              {t('xp_info_ok')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
