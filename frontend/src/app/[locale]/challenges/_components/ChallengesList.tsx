'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useAgeMode } from '@/lib/hooks/useAgeMode';
import { fetchChallenges, fetchClassMission, requestPremiumUnlock } from '@/lib/api/client';
import IdeasWallTab from '@/components/challenge/IdeasWallTab';
import type { components } from '@/lib/api/schema';

type ChallengeDetail = components['schemas']['ChallengeDetail'];

const CHALLENGE = '#1a6fa6'; // --color-challenge (AA-safe with white)

// ── Parent handoff (kids never check out — CLAUDE.md safety rule) ───────────────

function UpgradeHandoffModal({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations('challenge');

  // Queue a "Needs your OK" item on the parent dashboard (idempotent
  // server-side; fine to fire every time the modal opens).
  useEffect(() => {
    requestPremiumUnlock().catch(() => {});
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="upgrade-handoff-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mb-4 text-5xl" aria-hidden="true">🤝</div>
        <h2 className="mb-2 font-display text-xl font-bold text-ink">{t('upgrade_modal_title')}</h2>
        <p className="mb-5 font-body text-sm text-ink/70">{t('upgrade_modal_body')}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-pill bg-tint-blue px-6 py-2.5 font-display text-sm font-bold text-[#135A85] transition-all hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge"
        >
          {t('upgrade_modal_dismiss')}
        </button>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

type Tab = 'mission' | 'wall';

export default function ChallengesList() {
  const t = useTranslations('challenge');
  const router = useRouter();
  const ageMode = useAgeMode();

  const [challenges, setChallenges] = useState<ChallengeDetail[]>([]);
  const [assignedId, setAssignedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('mission');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [wallUnlocked, setWallUnlocked] = useState(false);
  const locale = useLocale();

  useEffect(() => {
    fetchChallenges(locale)
      .then((c) => setChallenges((c ?? []) as ChallengeDetail[]))
      .catch(() => {})
      .finally(() => setLoading(false));
    // The teacher's class assignment is the kid's real "current mission".
    fetchClassMission()
      .then((m) => setAssignedId(m?.challenge_id ?? null))
      .catch(() => {});
  }, [locale]);

  // Prefer the class-assigned mission; fall back to the first challenge.
  const featured =
    (assignedId && challenges.find((c) => c.id === assignedId)) || challenges[0] || null;

  useEffect(() => {
    if (!featured) return;
    try {
      setWallUnlocked(localStorage.getItem(`wallSubmitted_${featured.id}`) === 'true');
    } catch {
      /* ignore */
    }
  }, [featured]);

  return (
    <div data-testid="challenges-page" className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:px-8">
      {showUpgrade && <UpgradeHandoffModal onDismiss={() => setShowUpgrade(false)} />}

      {/* Header */}
      <header className="text-center">
        <h1 className="font-display text-4xl font-bold text-ink md:text-5xl">
          {t('header_title')}
        </h1>
        {featured && (
          <p className="mt-2 font-display text-lg font-bold text-ink/80 md:text-xl">
            {t.rich('header_today', {
              title: featured.title,
              hl: (chunks) => <span className="text-library-deep">{chunks}</span>,
            })}
          </p>
        )}
      </header>

      {/* Tab toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-pill bg-white p-1 shadow-sm" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'mission'}
            data-testid="tab-mission"
            onClick={() => setTab('mission')}
            className={`rounded-pill px-5 py-2 font-display text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge ${
              tab === 'mission' ? 'text-white' : 'text-ink/60 hover:text-ink'
            }`}
            style={tab === 'mission' ? { backgroundColor: CHALLENGE } : undefined}
          >
            {t('tab_mission')}
          </button>
          <button
            role="tab"
            aria-selected={tab === 'wall'}
            data-testid="tab-wall"
            onClick={() => setTab('wall')}
            className={`rounded-pill px-5 py-2 font-display text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge ${
              tab === 'wall' ? 'text-white' : 'text-ink/60 hover:text-ink'
            }`}
            style={tab === 'wall' ? { backgroundColor: CHALLENGE } : undefined}
          >
            {t('tab_wall')}
          </button>
        </div>
      </div>

      {loading && <div className="h-40 animate-pulse rounded-card bg-white" />}

      {/* ── Mission tab ─────────────────────────────────────────────────────── */}
      {!loading && tab === 'mission' && (
        <div className="flex flex-col gap-6">
          {/* Continue */}
          {featured && (
            <section aria-label={t('continue_aria')} className="flex flex-col gap-2">
              <h2 className="font-display text-2xl font-bold text-ink">{t('continue_heading')}</h2>
              <button
                type="button"
                data-testid="continue-mission"
                onClick={() => router.push(`/challenges/${featured.id}`)}
                className="flex items-center gap-4 rounded-[1.5rem] bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2"
              >
                <span
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-tint-cream text-3xl"
                  aria-hidden="true"
                >
                  {featured.emoji || '🚀'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold text-ink">{featured.title}</p>
                  <p className="line-clamp-1 font-body text-sm text-ink/60">{featured.brief}</p>
                </div>
                <span
                  className="hidden shrink-0 rounded-pill px-5 py-2.5 font-display text-sm font-bold text-white sm:inline-block"
                  style={{ backgroundColor: CHALLENGE }}
                >
                  {t('continue_button')}
                </span>
              </button>
            </section>
          )}

          {/* Challenge grid */}
          <section aria-label={t('challenges_aria')} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {challenges.map((c, i) => {
              // Prefer the server's entitlement decision; fall back to "first free".
              const locked = c.locked ?? i > 0;
              const assigned = c.id === assignedId;
              return locked ? (
                <LockedChallengeCard
                  key={c.id}
                  index={i + 1}
                  assigned={assigned}
                  onUpgrade={() => setShowUpgrade(true)}
                />
              ) : (
                <UnlockedChallengeCard
                  key={c.id}
                  index={i + 1}
                  challenge={c}
                  assigned={assigned}
                  onOpen={() => router.push(`/challenges/${c.id}`)}
                />
              );
            })}
          </section>
        </div>
      )}

      {/* ── Ideas Wall tab (IdeasWallTab renders its own safety banner) ──────── */}
      {!loading && tab === 'wall' && featured && (
        <IdeasWallTab
          challengeId={featured.id}
          ageMode={ageMode}
          wallUnlocked={wallUnlocked}
          onWriteMyIdea={() => router.push(`/challenges/${featured.id}`)}
        />
      )}
    </div>
  );
}

// ── Cards ──────────────────────────────────────────────────────────────────────

// Per-mission cover art. Missions not listed here fall back to the shared
// cover, so adding a new image is just a slug → path entry + the file.
const DEFAULT_COVER = '/challenge/mission-cover.png';
const COVER_BY_SLUG: Record<string, string> = {
  'the-guess-who-tree': '/challenge/guess-who-tree.png',
};
function coverFor(slug: string | undefined): string {
  return (slug && COVER_BY_SLUG[slug]) || DEFAULT_COVER;
}

function UnlockedChallengeCard({
  index,
  challenge,
  assigned = false,
  onOpen,
}: {
  index: number;
  challenge: ChallengeDetail;
  assigned?: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations('challenge');

  return (
    <button
      type="button"
      data-testid="challenge-card"
      data-assigned={assigned || undefined}
      onClick={onOpen}
      className={`group relative overflow-hidden rounded-[1.5rem] text-left shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2 ${
        assigned ? 'ring-2 ring-library ring-offset-2' : ''
      }`}
    >
      {assigned && (
        <span
          data-testid="assigned-badge"
          className="absolute left-3 top-3 z-10 rounded-pill bg-library px-3 py-1 font-display text-xs font-bold text-white shadow-md"
        >
          {t('pinned_badge')}
        </span>
      )}
      <div className="px-5 py-4 text-white" style={{ backgroundColor: CHALLENGE }}>
        <p className="font-display text-xl font-bold leading-tight">{challenge.title}</p>
        <p className="mt-0.5 line-clamp-1 font-body text-sm text-white/90">{challenge.brief}</p>
      </div>
      <div className="relative h-44">
        <Image
          src={coverFor(challenge.slug)}
          alt=""
          aria-hidden="true"
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 400px"
        />
        <span
          className="absolute bottom-3 right-3 flex h-16 w-16 items-center justify-center rounded-full text-center font-display text-xs font-bold leading-tight text-white shadow-md"
          style={{ backgroundColor: CHALLENGE }}
        >
          {t('challenge_badge', { index })}
        </span>
      </div>
    </button>
  );
}

function LockedChallengeCard({
  index,
  assigned = false,
  onUpgrade,
}: {
  index: number;
  assigned?: boolean;
  onUpgrade: () => void;
}) {
  const t = useTranslations('challenge');

  return (
    <button
      type="button"
      data-testid="challenge-card-locked"
      data-assigned={assigned || undefined}
      onClick={onUpgrade}
      aria-label={t('locked_card_aria', { index })}
      className={`group relative flex min-h-[15rem] flex-col items-center justify-center overflow-hidden rounded-[1.5rem] p-6 text-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2 ${
        assigned ? 'ring-2 ring-library ring-offset-2' : ''
      }`}
    >
      {assigned && (
        <span
          data-testid="assigned-badge"
          className="absolute left-3 top-3 z-10 rounded-pill bg-library px-3 py-1 font-display text-xs font-bold text-white shadow-md"
        >
          {t('pinned_badge')}
        </span>
      )}
      {/* Blurred, dimmed cover */}
      <Image
        src="/challenge/mission-cover.png"
        alt=""
        aria-hidden="true"
        fill
        className="scale-110 object-cover opacity-30 blur-[3px]"
        sizes="(max-width: 640px) 100vw, 400px"
      />
      <div className="absolute inset-0 bg-tint-blue/70" aria-hidden="true" />
      <span className="relative text-4xl" aria-hidden="true">🔒</span>
      <p className="relative mt-3 font-display text-lg font-bold text-ink">
        {t('locked_card_title')}
      </p>
      <span
        className="absolute bottom-3 right-3 flex h-16 w-16 items-center justify-center rounded-full font-display text-xs font-bold text-white shadow-md"
        style={{ backgroundColor: CHALLENGE }}
      >
        {t('challenge_badge', { index })}
      </span>
    </button>
  );
}
