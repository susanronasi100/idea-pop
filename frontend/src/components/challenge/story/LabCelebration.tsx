'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { btnPrimary, btnSecondary, btnText } from '@/components/challenge/buttons';

interface Props {
  /** Adds the photo to the kid's saved lab project; resolves false when it couldn't be saved. */
  onPhoto: (photo: File) => Promise<boolean>;
  onKeepExploring: () => void;
  onEnough: () => void;
}

const CONFETTI_COLORS = ['#2D9CDB', '#FFD93D', '#6BCB77', '#FF6B6B', '#C77DFF', '#FF9F45'];
const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 0.37) % 2.8).toFixed(2),
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

/** The lab is done: "What Did You Build?", an optional photo of the model (private, never
 *  published by itself), then keep exploring (SCAMPER) or stop for today. */
export default function LabCelebration({ onPhoto, onKeepExploring, onEnough }: Props) {
  const t = useTranslations('story');
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<'none' | 'saving' | 'saved' | 'failed'>('none');
  const goRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    goRef.current?.focus();
  }, []);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  return createPortal(
    <div className="app-typography fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-[rgba(15,40,70,0.45)] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lab-celebration-title"
        data-testid="lab-celebration"
        className="celebrate-pop relative my-auto w-full max-w-[460px] overflow-hidden rounded-[32px] bg-white px-6 pb-6 pt-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
      >
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="celebrate-fall absolute top-0 h-3 w-2 rounded-sm"
            style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s` }}
          />
        ))}

        <span aria-hidden="true" className="text-5xl">🧪</span>
        <h2 id="lab-celebration-title" className="mt-2 font-display text-3xl text-ink">
          {t('lab_cel_title')}
        </h2>
        <p className="mt-1.5 font-body text-base leading-relaxed text-ink/75">{t('lab_cel_text')}</p>

        <div className="mt-4 flex flex-col items-center gap-2 rounded-[18px] bg-[#EAF5FC] p-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={t('lab_add_photo')}
            data-testid="lab-photo-input"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setPreview(URL.createObjectURL(f));
              setState('saving');
              setState((await onPhoto(f)) ? 'saved' : 'failed');
            }}
          />
          {preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- the kid's own photo, a blob URL */}
              <img src={preview} alt="" data-testid="lab-photo-preview" className="max-h-40 rounded-xl object-contain" />
              <p aria-live="polite" className="font-body text-sm font-semibold text-[#1E7A44]">
                {state === 'saving' ? t('lab_photo_saving') : state === 'saved' ? t('lab_photo_saved') : state === 'failed' ? t('lab_photo_failed') : ''}
              </p>
              <button type="button" onClick={() => fileRef.current?.click()} className={btnText}>
                {t('lab_change_photo')}
              </button>
            </>
          ) : (
            <button type="button" data-testid="lab-add-photo" onClick={() => fileRef.current?.click()} className={btnSecondary}>
              📷 {t('lab_add_photo')}
            </button>
          )}
          <p className="font-body text-xs text-[#4A5560]">{t('photo_private_note')}</p>
        </div>

        <p data-testid="lab-cel-message" className="mt-4 font-body text-base font-bold leading-relaxed text-ink">
          {t('lab_cel_done_1')}
          <br />
          {t('lab_cel_done_2')}
          <br />
          {t('lab_cel_done_3')}
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <button ref={goRef} type="button" data-testid="lab-keep-exploring" onClick={onKeepExploring} disabled={state === 'saving'} className={`${btnPrimary} w-full`}>
            {t('lab_keep_exploring')}
          </button>
          <button type="button" data-testid="lab-enough" onClick={onEnough} disabled={state === 'saving'} className={`${btnSecondary} w-full`}>
            {t('enough_today')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
