'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { askMissionHelper } from '@/lib/api/client';
import PopiAvatar from '@/components/PopiAvatar';

interface MissionHelperProps {
  challengeId: string;
  /** Mission step 1-8 — the context the helper is anchored to. */
  step: number;
  /** Render already expanded (e.g. when opened from a CTA). */
  defaultOpen?: boolean;
  /** Increment to open the panel from outside (Brainstorm-with-Popi CTA). */
  openSignal?: number;
}

type Phase = 'idle' | 'loading' | 'answered' | 'blocked' | 'error';

/**
 * "Ask Popi" — the scoped AI helper (AI-helper-spec.md), fronted by the same
 * penguin character as the floating Ask-Me mascot. Same accordion anatomy as
 * MissionHints. NOT an open chat: one moderated question at a time. Scope is
 * the mission plus related nature/science/how-to-build learning — never
 * personal, social, or grown-up topics. The browser sends nothing but the
 * typed question; the server owns the model key, moderation, consent/rate
 * gates, and the transcript that parents and teachers can review.
 */
export default function MissionHelper({
  challengeId,
  step,
  defaultOpen = false,
  openSignal = 0,
}: MissionHelperProps) {
  const t = useTranslations('helper');
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);
  const [question, setQuestion] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [answer, setAnswer] = useState('');
  const [errorKey, setErrorKey] = useState<'rate_limited' | 'not_allowed' | 'error'>('error');

  async function handleAsk() {
    const q = question.trim();
    if (!q || phase === 'loading') return;
    setPhase('loading');
    try {
      const res = await askMissionHelper(challengeId, step, q);
      setAnswer(res.answer);
      setPhase(res.blocked ? 'blocked' : 'answered');
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      setErrorKey(code === 'rate_limited' ? 'rate_limited' : code === 'not_allowed' ? 'not_allowed' : 'error');
      setPhase('error');
    }
  }

  function reset() {
    setQuestion('');
    setAnswer('');
    setPhase('idle');
  }

  return (
    <div data-testid="mission-helper" className="overflow-hidden rounded-card border border-ink/20">
      <button
        type="button"
        data-testid="helper-toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between bg-tint-lavender px-4 py-3 font-display text-sm text-ink transition-colors hover:bg-tint-lavender-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/40"
      >
        <span className="flex items-center gap-2">
          {/* Same robot as the floating Ask-Me mascot — Popi is ONE character. */}
          <PopiAvatar size={36} className="shrink-0" />
          {t('toggle')}
        </span>
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
          <p className="font-body text-xs text-ink/50">{t('privacy')}</p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={question}
              maxLength={400}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAsk();
              }}
              disabled={phase === 'loading'}
              aria-label={t('input_label')}
              placeholder={t('placeholder')}
              data-testid="helper-question-input"
              className="flex-1 rounded-card border border-ink/20 px-3 py-2 font-body text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge disabled:opacity-50"
            />
            <button
              type="button"
              data-testid="helper-ask-btn"
              onClick={() => void handleAsk()}
              disabled={phase === 'loading' || question.trim().length === 0}
              className="rounded-pill bg-challenge px-5 py-2 font-display text-sm font-bold text-white transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:opacity-50"
            >
              {t('send')}
            </button>
          </div>

          {phase === 'loading' && (
            <p data-testid="helper-loading" role="status" className="flex items-center gap-2 font-body text-sm text-ink/60">
              <span
                aria-hidden="true"
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-challenge border-t-transparent"
              />
              {t('thinking')}
            </p>
          )}

          {phase === 'answered' && (
            <div data-testid="helper-answer" className="rounded-card bg-tint-blue p-3">
              <p className="font-display text-xs font-bold text-ink/60">🤖 {t('answer_label')}</p>
              <p className="mt-1 font-body text-sm text-ink">{answer}</p>
            </div>
          )}

          {phase === 'blocked' && (
            <p data-testid="helper-blocked" className="rounded-card bg-tint-blush p-3 font-body text-sm text-ink">
              {t('blocked')}
            </p>
          )}

          {phase === 'error' && (
            <p data-testid="helper-error" className="rounded-card bg-tint-cream p-3 font-body text-sm text-ink">
              {t(errorKey)}
            </p>
          )}

          {(phase === 'answered' || phase === 'blocked') && (
            <button
              type="button"
              data-testid="helper-ask-another"
              onClick={reset}
              className="self-start font-body text-sm font-semibold text-challenge hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge"
            >
              {t('ask_another')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
