'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import Link from 'next/link';
import AudiencePicker from './AudiencePicker';
import { submitIdea } from '@/lib/api/client';
import { btnPrimary } from '@/components/challenge/buttons';

type ChallengeDetail = import('@/lib/api/schema').components['schemas']['ChallengeDetail'];

interface StepCelebrateProps {
  challenge: ChallengeDetail;
  ageMode: 'young' | 'older';
  completionXp: number;
  /** XP for defining the problem (+5) and for solving it with a sketch (+10), when earned. */
  defineXp?: number;
  sketchXp?: number;
  sketchProjectId: string | null;
  wallAlreadySubmitted: boolean;
  onWallSubmitted: () => void;
  onRestart: () => void;
}

export default function StepCelebrate({
  challenge,
  completionXp,
  defineXp = 0,
  sketchXp = 0,
  sketchProjectId,
  wallAlreadySubmitted,
  onWallSubmitted,
  onRestart,
}: StepCelebrateProps) {
  const t = useTranslations('mission');
  const format = useFormatter();
  const tWall = useTranslations('ideas_wall');
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [wallDone, setWallDone] = useState(wallAlreadySubmitted);
  const [wallError, setWallError] = useState<string | null>(null);

  async function handleWallSubmit() {
    if (!sketchProjectId || sending) return;
    setSending(true);
    setWallError(null);
    try {
      await submitIdea(challenge.id, sketchProjectId, caption);
      setWallDone(true);
      onWallSubmitted();
    } catch (err: unknown) {
      if (err instanceof Error && (err as Error & { code?: string }).code === 'restricted') {
        setWallError(tWall('restricted_submit'));
      } else {
        setWallError(t('wall_post_error'));
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div data-testid="step-celebrate" className="flex flex-col gap-6 px-4 py-6">
      {/* Celebration header */}
      <div className="text-center py-8">
        <div className="text-6xl">🎉</div>
        <h2 className="font-display text-3xl text-challenge mt-3">{t('celebrate_heading')}</h2>
      </div>

      {/* XP card */}
      <div data-testid="celebrate-xp" className="bg-challenge text-white rounded-card p-6 text-center mb-6">
        <p className="font-body text-base font-bold text-white/90">{t('total_xp_heading')}</p>
        <p dir="ltr" className="font-display text-5xl">{t('xp_chip', { xp: completionXp + defineXp + sketchXp })}</p>
        <div className="mt-3 flex flex-col items-center gap-1">
          <p className="font-body text-base text-white/90">
            {t('xp_mission_complete')}: <span dir="ltr">+{format.number(completionXp)}</span>
          </p>
          {defineXp > 0 && (
            <p className="font-body text-base text-white/90">
              {t('xp_problem_defined')}: <span dir="ltr">+{format.number(defineXp)}</span>
            </p>
          )}
          {sketchXp > 0 && (
            <p className="font-body text-base text-white/90">
              {t('xp_problem_solved')}: <span dir="ltr">+{format.number(sketchXp)}</span>
            </p>
          )}
        </div>
      </div>

      {/* Audience picker — real API integration */}
      <AudiencePicker projectId={sketchProjectId} onDone={() => {}} />

      {/* Ideas Wall submission */}
      {!wallDone ? (
        <div
          data-testid="wall-submit-section"
          className="bg-white rounded-card shadow-sm p-4 flex flex-col gap-3"
        >
          <p className="font-body font-bold text-base text-ink">{t('wall_post_heading')}</p>
          <p className="font-body text-sm text-ink/50">
            {t('wall_post_note')}
          </p>

          <textarea
            data-testid="wall-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={tWall('submit_caption')}
            rows={2}
            className="w-full rounded-card border border-ink/20 px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-challenge resize-none"
          />

          {wallError && (
            <p data-testid="wall-submit-error" className="font-body text-sm text-red-500">
              {wallError}
            </p>
          )}

          <button
            type="button"
            data-testid="wall-submit-btn"
            onClick={handleWallSubmit}
            disabled={sending || !sketchProjectId}
            className={btnPrimary}
          >
            {sending ? tWall('submit_sending') : t('wall_share_button')}
          </button>

          <p className="font-body text-xs text-ink/50">
            {t('wall_review_note')}
          </p>
        </div>
      ) : (
        <div
          data-testid="wall-submitted-note"
          className="bg-tint-blue rounded-card p-4 text-center font-body text-sm text-ink"
        >
          {tWall('submit_done')}
        </div>
      )}

      {/* Action buttons */}
      <Link
        href="/challenges"
        className="bg-challenge text-white font-display text-lg px-6 py-3 rounded-card w-full text-center block"
      >
        {t('next_mission')}
      </Link>
    </div>
  );
}
