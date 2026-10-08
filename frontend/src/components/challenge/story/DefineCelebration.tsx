'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { btnPrimary } from '@/components/challenge/buttons';

interface Props {
  /** XP the server just awarded (0 when it was already given before). Define variant only. */
  xp?: number;
  onClose: () => void;
  /** 'define': the 5W problem is defined (+5 XP). 'solved': the first idea is sketched, so the
   *  problem is solved; it cheers and invites the kid on to find more ideas (TEMP rule 35). */
  variant?: 'define' | 'solved';
}

const CONFETTI_COLORS = ['#2D9CDB', '#FFD93D', '#6BCB77', '#FF6B6B', '#C77DFF', '#FF9F45'];
// Fixed positions and delays (no randomness), so every render looks the same.
const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 0.37) % 2.8).toFixed(2),
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

/** The reward for defining the problem with the 5W1H questions: the floating jellyfish,
 *  reward chips that bob around it, falling confetti, and a way back to the mission. */
export default function DefineCelebration({ xp = 0, onClose, variant = 'define' }: Props) {
  const solved = variant === 'solved';
  const t = useTranslations('story');
  const goRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    goRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const chip =
    'celebrate-bob absolute flex items-center gap-1.5 rounded-pill px-3 py-1.5 font-body text-xs font-extrabold shadow-[0_6px_16px_rgba(0,0,0,0.14)] sm:text-sm';

  // Rendered on the page body: an animated ancestor would otherwise trap the overlay inside it.
  return createPortal(
    <div
      className="app-typography fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(15,40,70,0.45)] p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="define-celebration-title"
        data-testid="define-celebration"
        onClick={(e) => e.stopPropagation()}
        className="celebrate-pop relative w-full max-w-[440px] overflow-hidden rounded-[32px] bg-white px-6 pb-6 pt-5 text-center shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
      >
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="celebrate-fall absolute top-0 h-3 w-2 rounded-sm"
            style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s` }}
          />
        ))}

        <div className="relative h-[250px]" aria-hidden="true">
          <div className="absolute left-1/2 top-1/2 h-[230px] w-[230px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_45%_40%,#E9FBFF,#C9F0FF_45%,#B3E4FF_72%,transparent_73%)]" />
          {/* eslint-disable-next-line @next/next/no-img-element -- a decorative cut-out */}
          <img
            src="/challenge/celebrate/jellyfish.png"
            alt=""
            className="celebrate-float absolute bottom-1 left-1/2 h-[230px] drop-shadow-[0_0_18px_rgba(80,200,255,0.75)]"
          />
          <span className={`${chip} left-1 top-5 bg-white text-ink`}>
            ⭐ <span dir="ltr">+{xp > 0 ? xp : solved ? 10 : 5} XP</span>
          </span>
          {solved && (
            <span className={`${chip} right-1 top-16 bg-white text-ink`} style={{ animationDelay: '0.6s' }}>
              🏅 {t('solved_badge')}
            </span>
          )}
          <span className={`${chip} bottom-8 left-3 bg-white text-ink`} style={{ animationDelay: '1.2s' }}>
            ✅ {solved ? t('solved_chip') : t('celebrate_defined')}
          </span>
          <span className="celebrate-twinkle absolute left-[28%] top-2 text-xl">✨</span>
          <span
            className="celebrate-twinkle absolute right-[24%] top-[150px] text-xl"
            style={{ animationDelay: '0.8s' }}
          >
            ✨
          </span>
          <span
            className="celebrate-twinkle absolute left-[16%] top-[120px] text-xl"
            style={{ animationDelay: '0.4s' }}
          >
            ⭐
          </span>
        </div>

        <h2 id="define-celebration-title" className="mt-3 font-display text-3xl text-ink">
          {solved ? (
            <>
              {t('solved_title_1')} <span className="text-challenge">{t('solved_title_2')}</span>
            </>
          ) : (
            <>
              {t('celebrate_title_1')} <span className="text-challenge">{t('celebrate_title_2')}</span>{' '}
              <span className="text-challenge">{t('celebrate_title_3')}</span>
            </>
          )}
        </h2>
        <p className="mt-1.5 font-body text-base leading-relaxed text-ink/75">{solved ? t.rich('solved_text', { b: (chunks) => <b className="font-extrabold text-ink">{chunks}</b> }) : t('celebrate_text')}</p>
        <button
          ref={goRef}
          type="button"
          data-testid="define-celebration-go"
          onClick={onClose}
          className={`${btnPrimary} mt-5 w-full`}
        >
          {solved ? t('solved_go') : t('celebrate_go')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
