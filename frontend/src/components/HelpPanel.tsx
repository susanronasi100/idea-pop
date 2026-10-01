'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import PopiAvatar from '@/components/PopiAvatar';

/** Which "how this works" blurb to show — chosen from the current route. */
export type HelpSection =
  | 'profile'
  | 'explore'
  | 'library'
  | 'challenge'
  | 'studio'
  | 'mission'
  | 'default';

const BODY_KEY: Record<HelpSection, string> = {
  profile: 'body_profile',
  explore: 'body_explore',
  library: 'body_library',
  challenge: 'body_challenge',
  studio: 'body_studio',
  mission: 'body_mission',
  default: 'body_default',
};

export interface HelpPanelProps {
  section: HelpSection;
  onClose: () => void;
}

/**
 * Small "how this works" panel opened by the floating penguin. Content is
 * context-aware by section; on a mission it points to the step-scoped "Ask
 * Popi" helper (that helper is embedded per step and can't be opened globally).
 */
export default function HelpPanel({ section, onClose }: HelpPanelProps) {
  const t = useTranslations('help_panel');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        data-testid="help-panel"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[1.5rem] bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <PopiAvatar size={48} />
            <h2 className="font-display text-lg font-bold text-ink">{t('title')}</h2>
          </div>
          <button
            type="button"
            data-testid="help-panel-close"
            onClick={onClose}
            aria-label={t('close')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/5 text-lg text-ink/70 transition-colors hover:bg-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <p className="mt-3 font-body text-sm leading-relaxed text-ink/80">
          {t(BODY_KEY[section])}
        </p>
      </div>
    </div>
  );
}
