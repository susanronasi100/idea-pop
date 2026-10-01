'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { fetchClassMission } from '@/lib/api/client';
import PopiAvatar from '@/components/PopiAvatar';

// ─── ParentHandoffModal ───────────────────────────────────────────────────────
// Safety rule: kids MUST see this modal when tapping any paid-plan CTA.
// Never route a kid to a checkout or billing page directly.

function ParentHandoffModal({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations('kid_dashboard');

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={t('parent_handoff_heading')}
      data-testid="parent-handoff-modal"
    >
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4">
        <div className="text-5xl text-center mb-4">🤝</div>
        <h2 className="font-display text-xl font-bold text-ink text-center mb-2">
          {t('parent_handoff_heading')}
        </h2>
        <p className="font-body text-ink/70 text-center mb-6">
          {t('parent_handoff_body')}
        </p>
        <Button
          variant="secondary"
          className="w-full"
          onClick={onDismiss}
        >
          {t('parent_handoff_dismiss')}
        </Button>
      </div>
    </div>
  );
}

// ─── Mock content helpers ─────────────────────────────────────────────────────
// Placeholder preview content (titles come from the catalog) shown until the
// real Explore/Library data loads for an unlocked account.

const exploreVideos = [
  { emoji: '🦑', titleKey: 'demo_explore_1', xp: 5 },
  { emoji: '🌿', titleKey: 'demo_explore_2', xp: 5 },
  { emoji: '🕷️', titleKey: 'demo_explore_3', xp: 5 },
];

const libraryCards = [
  { emoji: '🔨', titleKey: 'demo_library_1' },
  { emoji: '🌱', titleKey: 'demo_library_2' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KidDashboardPage() {
  const t = useTranslations('kid_dashboard');
  const tp = useTranslations('pricing');
  const format = useFormatter();

  const [nickname, setNickname] = useState('');
  const [showHandoff, setShowHandoff] = useState(false);
  const [classMission, setClassMission] = useState<{ challenge_id: string; title: string } | null>(
    null,
  );

  useEffect(() => {
    const stored = localStorage.getItem('ideapop_nickname');
    if (stored) setNickname(stored);
    // Surface the mission the kid's teacher assigned to their class, if any.
    fetchClassMission()
      .then(setClassMission)
      .catch(() => {});
  }, []);

  const displayName = nickname || t('default_nickname');

  function openHandoff() {
    // Safety: intercepting all upgrade/paid CTAs for kids — show parent handoff
    // instead of routing to checkout. Never let kids reach billing pages.
    setShowHandoff(true);
  }

  return (
    <>
      {showHandoff && <ParentHandoffModal onDismiss={() => setShowHandoff(false)} />}

      {/* ── Restricted banner ─────────────────────────────────────── */}
      <div
        className="w-full bg-tint-lime border-b border-ink/10 px-4 py-3 flex items-center gap-2"
        data-testid="restricted-banner"
      >
        <span aria-hidden="true">🔔</span>
        <p className="font-body text-sm text-ink">{t('restricted_banner')}</p>
      </div>

      <div className="px-4 pb-12">
        {/* ── XP / level strip ──────────────────────────────────────── */}
        <div className="flex items-center gap-3 mt-6 mb-8">
          <PopiAvatar size={52} />
          <div>
            <p className="font-display font-bold text-ink text-lg leading-none">
              {t('welcome', { nickname: displayName })}
            </p>
            <p className="font-body text-sm text-ink/60 mt-0.5">
              {t('level_label', { n: 1 })} ·{' '}
              <span dir="ltr">{format.number(0)} {t('xp_label')}</span>
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto space-y-8">
          {/* ── Section A: Explore ──────────────────────────────────── */}
          <section className="bg-tint-lime rounded-card p-6">
            <h2 className="font-display font-bold text-xl text-ink mb-4">
              {t('explore_title')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {exploreVideos.map((v) => (
                <Link
                  key={v.titleKey}
                  href="/explore"
                  aria-label={t(v.titleKey)}
                  className="bg-white rounded-card overflow-hidden shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-explore focus-visible:ring-offset-2"
                >
                  <div className="h-20 bg-ink/5 flex items-center justify-center text-4xl">
                    {v.emoji}
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <p className="font-body text-xs text-ink font-semibold leading-snug">
                      {t(v.titleKey)}
                    </p>
                    <span dir="ltr" className="text-xs font-semibold text-explore bg-tint-lime rounded-pill px-2 py-0.5 ml-2 shrink-0">
                      {t('demo_explore_xp', { xp: v.xp })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Section B: Library (locked) ─────────────────────────── */}
          <section className="bg-tint-blue rounded-card p-6" data-testid="library-locked">
            <h2 className="font-display font-bold text-xl text-ink mb-4">
              {t('library_title')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {libraryCards.map((c) => (
                <div key={c.titleKey} className="relative bg-white rounded-card overflow-hidden shadow-sm">
                  <div className="h-24 bg-ink/5 flex items-center justify-center text-4xl">
                    {c.emoji}
                  </div>
                  <div className="p-3">
                    <p className="font-body text-sm text-ink font-semibold">{t(c.titleKey)}</p>
                  </div>
                  {/* Locked overlay */}
                  <div className="absolute inset-0 bg-ink/60 rounded-card flex items-center justify-center text-white font-semibold gap-2">
                    <span aria-hidden="true">🔒</span>
                    <span className="font-body">{t('locked_label')}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Section C: This week's mission ──────────────────────── */}
          <section className="bg-tint-cream rounded-card p-6">
            <h2 className="font-display font-bold text-xl text-ink mb-4">
              {t('challenges_title')}
            </h2>
            {classMission ? (
              // The kid's class has an assigned mission — surface THAT, unlocked
              // and linking straight into it.
              <Link
                href={`/challenges/${classMission.challenge_id}`}
                data-testid="class-mission-card"
                className="relative block bg-white rounded-card overflow-hidden shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2"
              >
                <div className="h-28 bg-tint-blue flex items-center justify-center text-5xl">
                  🏆
                </div>
                <div className="p-4">
                  <span className="inline-block rounded-pill bg-library px-3 py-0.5 font-display text-xs font-bold text-white mb-1.5">
                    {t('class_mission_badge')}
                  </span>
                  <p data-testid="class-mission-title" className="font-body text-sm text-ink font-semibold">
                    {classMission.title}
                  </p>
                  <p className="font-body text-xs text-ink/60 mt-1">{t('class_mission_sub')}</p>
                </div>
              </Link>
            ) : (
              <div className="relative bg-white rounded-card overflow-hidden shadow-sm">
                <div className="h-28 bg-ink/5 flex items-center justify-center text-5xl">
                  🏆
                </div>
                <div className="p-4">
                  <p className="font-body text-sm text-ink font-semibold">
                    {t('demo_mission_title')}
                  </p>
                  <p className="font-body text-xs text-ink/60 mt-1">
                    {t('demo_mission_sub')}
                  </p>
                </div>
                {/* Locked overlay */}
                <div className="absolute inset-0 bg-ink/60 rounded-card flex items-center justify-center text-white font-semibold gap-2">
                  <span aria-hidden="true">🔒</span>
                  <span className="font-body">{t('locked_label')}</span>
                </div>
              </div>
            )}
          </section>

          {/* ── Pricing teaser ──────────────────────────────────────── */}
          <section
            className="bg-tint-lavender rounded-2xl p-6 mt-8"
            data-testid="pricing-section"
          >
            <h2 className="font-display font-bold text-xl text-ink mb-1">
              {t('upgrade_heading')}
            </h2>
            <p className="font-body text-sm text-ink/70 mb-6">{t('upgrade_body')}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Free plan */}
              <div className="bg-white rounded-card p-5 shadow-sm">
                <p className="font-display font-bold text-lg text-ink mb-0.5">
                  {tp('free_label')}
                </p>
                <p dir="ltr" className="font-display text-3xl font-bold text-ink mb-4">{tp('free_price')}</p>
                <ul className="space-y-1 mb-5">
                  <li className="font-body text-sm text-ink/70 flex items-start gap-1.5">
                    <span className="text-explore mt-0.5">✓</span> {t('free_feat_1')}
                  </li>
                  <li className="font-body text-sm text-ink/70 flex items-start gap-1.5">
                    <span className="text-explore mt-0.5">✓</span> {t('free_feat_2')}
                  </li>
                  <li className="font-body text-sm text-ink/70 flex items-start gap-1.5">
                    <span className="text-explore mt-0.5">✓</span> {t('free_feat_3')}
                  </li>
                </ul>
                {/* Safety: clicking this opens the parent handoff modal, NOT checkout */}
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={openHandoff}
                >
                  {t('free_cta')}
                </Button>
              </div>

              {/* Standard plan */}
              <div className="bg-white rounded-card p-5 shadow-sm ring-2 ring-explore">
                <p className="font-display font-bold text-lg text-ink mb-0.5">
                  {tp('standard_label')}
                </p>
                <p dir="ltr" className="font-display text-3xl font-bold text-ink mb-0.5">
                  {tp('monthly_price')}
                  <span className="text-base font-body font-normal text-ink/60"> {tp('per_month')}</span>
                </p>
                <p dir="ltr" className="font-body text-xs text-ink/50 mb-4">
                  {tp('annual_note')}
                </p>
                <ul className="space-y-1 mb-5">
                  <li className="font-body text-sm text-ink/70 flex items-start gap-1.5">
                    <span className="text-explore mt-0.5">✓</span> {t('plus_feat_1')}
                  </li>
                  <li className="font-body text-sm text-ink/70 flex items-start gap-1.5">
                    <span className="text-explore mt-0.5">✓</span> {t('plus_feat_2')}
                  </li>
                  <li className="font-body text-sm text-ink/70 flex items-start gap-1.5">
                    <span className="text-explore mt-0.5">✓</span> {t('plus_feat_3')}
                  </li>
                  <li className="font-body text-sm text-ink/70 flex items-start gap-1.5">
                    <span className="text-explore mt-0.5">✓</span> {t('plus_feat_4')}
                  </li>
                </ul>
                {/* Safety: clicking this opens the parent handoff modal, NOT checkout */}
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={openHandoff}
                >
                  {t('plus_cta')}
                </Button>
              </div>
            </div>

            <p className="font-body text-xs text-ink/50 italic text-center mt-4">
              {tp('kid_note')}
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
