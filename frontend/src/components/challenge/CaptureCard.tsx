'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import MissionHelper from './MissionHelper';
import PopiAvatar from '@/components/PopiAvatar';
import { btnPrimary, btnText } from '@/components/challenge/buttons';

// Dark-launch flag for the scoped AI helper (server enforces the real gates).
const HELPER_ON = process.env.NEXT_PUBLIC_MISSION_HELPER === 'true';

export interface CaptureData {
  title: string;
  what_i_made: string;
  what_i_used: string;
  what_was_hard?: string;
  what_id_improve?: string;
}

interface CaptureCardProps {
  showExtendedFields?: boolean;
  photoPrompt: string;
  onSubmit: (data: CaptureData) => void;
  submitting?: boolean;
  submitLabel: string;
  ageMode: 'young' | 'older';
  /** Step already renders its own MissionHelper: the CTA opens THAT one. */
  onBrainstorm?: () => void;
  /** No helper on this step yet: the CTA reveals an embedded one. */
  helper?: { challengeId: string; step: number };
}

export default function CaptureCard({
  showExtendedFields = false,
  photoPrompt,
  onSubmit,
  submitting = false,
  submitLabel,
  ageMode,
  onBrainstorm,
  helper,
}: CaptureCardProps) {
  const t = useTranslations('mission');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [whatIMade, setWhatIMade] = useState('');
  const [whatIUsed, setWhatIUsed] = useState('');
  const [whatWasHard, setWhatWasHard] = useState('');
  const [whatIdImprove, setWhatIdImprove] = useState('');
  const [showPopi, setShowPopi] = useState(false);

  const canSubmit = title.trim().length > 0 && whatIMade.trim().length > 0;

  // Revoke the object URL when it changes or the card unmounts, so previewing
  // a photo doesn't leak blob URLs.
  useEffect(() => {
    if (!photoUrl) return;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUrl(URL.createObjectURL(file));
  }

  function removePhoto() {
    setPhotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSubmit() {
    if (!canSubmit || submitting) return;
    onSubmit({
      title: title.trim(),
      what_i_made: whatIMade.trim(),
      what_i_used: whatIUsed.trim(),
      ...(showExtendedFields && {
        what_was_hard: whatWasHard.trim(),
        what_id_improve: whatIdImprove.trim(),
      }),
    });
  }

  const inputClass =
    'w-full rounded-card border border-ink/20 px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-challenge';

  return (
    <div data-testid="capture-card" className="flex flex-col gap-4">
      {/* Photo upload area — a real file picker with a live preview. Optional:
          nothing is submitted if no photo is chosen. */}
      <div
        data-testid="photo-area"
        className="bg-tint-blue rounded-card border-2 border-dashed border-challenge/30"
      >
        <input
          autoComplete="off"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          aria-label={photoPrompt}
          data-testid="photo-input"
          onChange={handlePhotoChange}
          className="sr-only"
        />
        {photoUrl ? (
          <div className="flex flex-col items-center gap-3 p-4">
            {/* Blob preview of the chosen image — next/image can't size a blob. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt=""
              data-testid="photo-preview"
              className="max-h-56 w-full rounded-card object-contain"
            />
            <div className="flex gap-5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={btnText}
              >
                {t('change_photo')}
              </button>
              <button
                type="button"
                onClick={removePhoto}
                className={btnText}
              >
                {t('remove_photo')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center py-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-challenge"
          >
            <span className="text-4xl" aria-hidden="true">
              📷
            </span>
            <p className="font-body text-sm text-ink/50 text-center mt-2 px-4">{photoPrompt}</p>
          </button>
        )}
      </div>

      {/* Title / What did you make? */}
      <div className="flex flex-col gap-1">
        <label className="font-body text-sm text-ink/60">{t('capture_title_label')}</label>
        <input
          autoComplete="off"
          data-testid="field-title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setWhatIMade(e.target.value);
          }}
          placeholder={t('capture_title_placeholder')}
          className={inputClass}
        />
      </div>

      {/* What did you use? */}
      <div className="flex flex-col gap-1">
        <label className="font-body text-sm text-ink/60">{t('capture_used_label')}</label>
        <input
          autoComplete="off"
          data-testid="field-used"
          type="text"
          value={whatIUsed}
          onChange={(e) => setWhatIUsed(e.target.value)}
          placeholder={t('capture_used_placeholder')}
          className={inputClass}
        />
      </div>

      {/* Extended fields */}
      {showExtendedFields && (
        <>
          <div className="flex flex-col gap-1">
            <label className="font-body text-sm text-ink/60">{t('capture_hard_label')}</label>
            <input
              autoComplete="off"
              data-testid="field-hard"
              type="text"
              value={whatWasHard}
              onChange={(e) => setWhatWasHard(e.target.value)}
              placeholder={t('capture_hard_placeholder')}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-body text-sm text-ink/60">{t('capture_improve_label')}</label>
            <input
              autoComplete="off"
              data-testid="field-improve"
              type="text"
              value={whatIdImprove}
              onChange={(e) => setWhatIdImprove(e.target.value)}
              placeholder={t('capture_improve_placeholder')}
              className={inputClass}
            />
          </div>
        </>
      )}

      {/* Brainstorm with Popi — opens the step's real helper when the
          dark-launch flag is on; otherwise keeps the coming-soon note. */}
      <div className="relative">
        <button
          type="button"
          data-testid="ai-hint"
          onClick={() => {
            if (HELPER_ON && onBrainstorm) onBrainstorm();
            else setShowPopi((prev) => !prev);
          }}
          className="flex w-full items-center gap-2 rounded-card bg-tint-lavender p-3 font-body text-sm text-ink/60 transition-colors hover:bg-tint-lavender-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/40"
        >
          <PopiAvatar size={28} />
          <span>{t('brainstorm_popi')}</span>
        </button>
        {showPopi &&
          (HELPER_ON && helper ? (
            <div className="mt-1">
              <MissionHelper challengeId={helper.challengeId} step={helper.step} defaultOpen />
            </div>
          ) : (
            !HELPER_ON && (
              <div className="mt-1 rounded-card border border-ink/10 bg-white px-3 py-2 font-body text-sm text-ink/60 shadow-sm">
                {t('popi_coming_soon')}
              </div>
            )
          ))}
      </div>

      {/* Submit */}
      <button
        data-testid="capture-submit"
        type="button"
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
        className={`${btnPrimary} w-full`}
      >
        {submitting ? t('saving') : submitLabel}
      </button>
    </div>
  );
}
