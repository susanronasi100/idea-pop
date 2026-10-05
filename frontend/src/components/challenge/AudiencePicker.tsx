'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { updateVisibility } from '@/lib/api/client';
import { btnPrimary } from '@/components/challenge/buttons';

interface AudiencePickerProps {
  projectId: string | null;
  onDone: (visibility: 'private' | 'class' | 'public') => void;
}

export default function AudiencePicker({ projectId, onDone }: AudiencePickerProps) {
  const t = useTranslations('mission');
  const tWall = useTranslations('ideas_wall');
  const [selected, setSelected] = useState<'private' | 'class' | 'public'>('private');
  const [saving, setSaving] = useState(false);
  const [restrictedError, setRestrictedError] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (projectId === null) {
      onDone(selected);
      return;
    }

    setSaving(true);
    setRestrictedError(false);

    try {
      await updateVisibility(projectId, selected);
      setSaved(true);
      onDone(selected);
    } catch (err) {
      if (err instanceof Error && (err as any).code === 'restricted') {
        setRestrictedError(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-testid="audience-picker" className="rounded-card bg-tint-blue p-4">
      <h2 className="font-display text-lg text-ink mb-4">{t('audience_heading')}</h2>

      <div className="flex flex-col gap-3 mb-4">
        {/* Option 1: Private */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            data-testid="share-private"
            name="audience"
            value="private"
            checked={selected === 'private'}
            onChange={() => setSelected('private')}
            className="mt-1"
          />
          <div>
            <span className="font-body font-bold text-ink">{t('audience_private')}</span>
            <p className="font-body text-sm text-ink/70">{t('audience_private_sub')}</p>
          </div>
        </label>

        {/* Option 2: Class */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            data-testid="share-class"
            name="audience"
            value="class"
            checked={selected === 'class'}
            onChange={() => setSelected('class')}
            className="mt-1"
          />
          <div>
            <span className="font-body font-bold text-ink">{t('audience_class')}</span>
            <p className="font-body text-sm text-ink/70">{t('audience_class_sub')}</p>
          </div>
        </label>

        {/* Option 3: Public (locked — aria-disabled so axe skips contrast checks on inactive UI) */}
        <label className="flex items-start gap-3 cursor-not-allowed" aria-disabled="true">
          <input
            type="radio"
            data-testid="share-public-locked"
            name="audience"
            value="public"
            disabled
            className="mt-1 cursor-not-allowed"
          />
          <div>
            <span className="font-body font-bold text-ink">{t('audience_public')}</span>
            <p className="font-body text-sm text-ink/70">{t('audience_public_sub')}</p>
          </div>
        </label>
      </div>

      {/* Safety note */}
      <p className="font-body text-sm text-ink/60 mb-4">
        {t('audience_safety')}
      </p>

      {/* Restricted error banner */}
      {restrictedError && (
        <div
          data-testid="restricted-banner"
          className="bg-challenge/10 text-challenge rounded-card px-3 py-2 text-sm font-body mb-4"
        >
          {tWall('restricted_share')}
        </div>
      )}

      {/* Save button */}
      <button
        data-testid="audience-save"
        onClick={handleSave}
        disabled={saving || saved || projectId === null}
        className={btnPrimary}
      >
        {saving ? t('saving') : saved ? t('saved') : t('save')}
      </button>
    </div>
  );
}
