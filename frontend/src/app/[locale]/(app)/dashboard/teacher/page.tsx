'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import {
  fetchTeacherClass,
  fetchChallenges,
  assignMission,
  fetchClassGallery,
} from '@/lib/api/client';
import { AVATARS } from '@/lib/avatars';
import ClassRoster from '@/components/teacher/ClassRoster';
import ClassReport from '@/components/teacher/ClassReport';
import type { components } from '@/lib/api/schema';

type TeacherClass = components['schemas']['TeacherClass'];
type ClassGalleryItem = components['schemas']['ClassGalleryItem'];
type ChallengeDetail = components['schemas']['ChallengeDetail'];

const DEEP = '#2E5F4B';
const BLUE = '#1E7FB8';

function avatarEmoji(id: string): string {
  return AVATARS.find((a) => a.id === id)?.emoji ?? '🧒';
}

// ── Header ────────────────────────────────────────────────────────────────────

function DashboardHeader({ classData }: { classData: TeacherClass }) {
  const t = useTranslations('teacher_dashboard');
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-tint-cream text-3xl"
          aria-hidden="true"
        >
          🧑‍🏫
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            {t('heading')}
          </h1>
          <p className="font-body text-sm text-ink/60">
            {t('students_in_class', { count: classData.student_count })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-pill bg-white px-4 py-2 font-body text-sm font-semibold text-ink shadow-sm">
          {classData.name}
        </span>
        <Link
          href="/onboarding/teacher"
          className="rounded-pill px-5 py-2 font-display text-sm font-bold text-white shadow-sm transition-all hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ backgroundColor: DEEP }}
        >
          {t('add_class')}
        </Link>
      </div>
    </div>
  );
}

// ── Class code bar ──────────────────────────────────────────────────────────

function ClassCodeBar({ classData }: { classData: TeacherClass }) {
  const t = useTranslations('teacher_dashboard');
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(classData.class_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      data-testid="class-code-card"
      className="flex flex-col gap-3 rounded-card bg-[#EDF6C5] px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="font-body text-base font-bold text-ink">
        {t('class_code_label')}:{' '}
        <span data-testid="class-code" dir="ltr" className="tracking-wide text-[#2E5F4B]">
          {classData.class_code}
        </span>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="copy-code-btn"
          onClick={handleCopy}
          className="rounded-pill bg-[#CDEB5A] px-6 py-2 font-display text-sm font-bold text-[#1F4D33] shadow-sm transition-all hover:brightness-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D33] focus-visible:ring-offset-2"
        >
          {copied ? t('copied') : t('copy_code')}
        </button>
        <button
          type="button"
          data-testid="print-letter-btn"
          onClick={() => window.print()}
          className="rounded-pill border-2 border-[#2E5F4B]/60 bg-white px-6 py-2 font-display text-sm font-bold text-[#2E5F4B] transition-all hover:bg-[#F4FADD] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5F4B] focus-visible:ring-offset-2"
        >
          {t('print_letter')}
        </button>
      </div>
    </div>
  );
}

// ── This week's mission ───────────────────────────────────────────────────────

function MissionSection({
  classData,
  challenges,
  onAssigned,
}: {
  classData: TeacherClass;
  challenges: ChallengeDetail[];
  onAssigned: (challengeId: string) => void;
}) {
  const t = useTranslations('teacher_dashboard');
  const [selectedId, setSelectedId] = useState(classData.assigned_challenge_id ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleAssign() {
    if (!selectedId || saving) return;
    setSaving(true);
    try {
      await assignMission(selectedId);
      onAssigned(selectedId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* silently fail */
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-bold text-ink">{t('mission_heading')}</h2>
      <div
        data-testid="assign-mission-section"
        className="flex flex-col gap-4 rounded-card bg-[#CDEBFA] p-5"
      >
        <p className="font-display text-lg font-bold text-[#17567D]">
          🏔️{' '}
          {classData.assigned_challenge_title
            ? t('mission_current', { title: classData.assigned_challenge_title })
            : t('mission_none')}
        </p>

        {/* progress: assigned = full, unassigned = empty (no finished-count from API) */}
        <div className="h-3 w-full overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-[#2D9CDB] transition-all"
            style={{ width: classData.assigned_challenge_id ? '100%' : '0%' }}
          />
        </div>
        <p className="font-body text-sm font-semibold text-[#17567D]">
          {t('students_in_this_class', { count: classData.student_count })}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="challenge-select" className="sr-only">
            {t('challenge_select_label')}
          </label>
          <select
            id="challenge-select"
            data-testid="challenge-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="flex-1 rounded-pill border border-[#17567D]/25 bg-white px-4 py-2.5 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[#1E7FB8]"
          >
            <option value="">{t('mission_placeholder')}</option>
            {challenges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="assign-btn"
            onClick={handleAssign}
            disabled={!selectedId || saving}
            className="rounded-pill px-6 py-2.5 font-display text-sm font-bold text-white shadow-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ backgroundColor: BLUE }}
          >
            {saving ? t('assigning') : saved ? t('assigned') : t('assign_btn')}
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Class gallery ─────────────────────────────────────────────────────────────

function ClassGallery({ items }: { items: ClassGalleryItem[] }) {
  const t = useTranslations('teacher_dashboard');
  return (
    <section data-testid="class-gallery" className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-bold text-ink">{t('gallery_heading')} 🏫</h2>
      {items.length === 0 ? (
        <p className="rounded-card bg-white p-6 text-center font-body text-sm text-ink/50">
          {t('gallery_empty')}
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {items.map((item) => (
            <div
              key={item.id}
              data-testid="gallery-item"
              className="w-56 shrink-0 rounded-card border-2 border-[#CDEB5A] bg-white p-3 shadow-sm"
            >
              <div className="flex h-28 items-center justify-center rounded-lg bg-ink/5 text-3xl text-ink/30" aria-hidden="true">
                {item.project_photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.project_photo_url} alt="" className="h-full w-full rounded-lg object-cover" />
                ) : (
                  '📷'
                )}
              </div>
              <p className="mt-2 font-display text-sm font-bold text-ink">
                {avatarEmoji(item.student_avatar_id)} {item.student_nickname}
              </p>
              <span className="mt-1 inline-block rounded-pill bg-[#EDF6C5] px-3 py-0.5 font-body text-xs text-ink/70">
                {item.project_title}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Info box ──────────────────────────────────────────────────────────────────

function BringHomeBox() {
  const t = useTranslations('teacher_dashboard');
  return (
    <div className="rounded-card border-2 border-dashed border-ink/20 bg-tint-lavender/40 p-5">
      <p className="font-display font-bold text-[#2E5F4B]">{t('bring_home_title')}</p>
      <p className="mt-1 font-body text-sm text-ink/70">
        {t('bring_home_body')}
      </p>
      <p className="mt-1 font-body text-sm text-ink/70">
        {t('licensing_label')}{' '}
        <Link href="/for-teachers" className="font-bold text-[#2E5F4B] underline-offset-2 hover:underline">
          {t('licensing_cta')}
        </Link>
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeacherDashboardPage() {
  const t = useTranslations('teacher_dashboard');
  const locale = useLocale();
  const [classData, setClassData] = useState<TeacherClass | null>(null);
  const [challenges, setChallenges] = useState<ChallengeDetail[]>([]);
  const [gallery, setGallery] = useState<ClassGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchTeacherClass().catch(() => null),
      fetchChallenges(locale).catch(() => [] as ChallengeDetail[]),
      fetchClassGallery().catch(() => [] as ClassGalleryItem[]),
    ]).then(([cls, chal, gal]) => {
      setClassData(cls as TeacherClass | null);
      setChallenges((chal ?? []) as ChallengeDetail[]);
      setGallery((gal ?? []) as ClassGalleryItem[]);
      setLoading(false);
    });
  }, [locale]);

  function handleAssigned(challengeId: string) {
    const c = challenges.find((x) => x.id === challengeId);
    if (c && classData) {
      setClassData({
        ...classData,
        assigned_challenge_id: challengeId,
        assigned_challenge_title: c.title,
      });
    }
  }

  return (
    <div data-testid="teacher-dashboard" className="mx-auto flex max-w-3xl flex-col gap-7 px-4 py-8">
      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="h-20 animate-pulse rounded-card bg-white" />
          <div className="h-32 animate-pulse rounded-card bg-white" />
        </div>
      ) : classData ? (
        <>
          <DashboardHeader classData={classData} />
          <ClassCodeBar classData={classData} />
          <MissionSection
            classData={classData}
            challenges={challenges}
            onAssigned={handleAssigned}
          />
          <ClassRoster />
          <ClassReport />
          <ClassGallery items={gallery} />
          <BringHomeBox />
        </>
      ) : (
        <div className="flex flex-col gap-3 rounded-card bg-tint-cream p-6 text-center">
          <p className="font-display text-lg font-bold text-ink">{t('no_class_heading')}</p>
          <p className="font-body text-sm text-ink/60">
            {t('no_class_hint')}
          </p>
          <Link
            href="/onboarding/teacher"
            className="font-body text-sm font-bold text-explore underline"
          >
            {t('no_class_cta')}
          </Link>
        </div>
      )}
    </div>
  );
}
