'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { fetchStudios, fetchQuickMakes, fetchCourses } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

type StudioCountResponse = components['schemas']['StudioCountResponse'];
type QuickMakePageResponse = components['schemas']['QuickMakePageResponse'];
type QuickMakeResponse = components['schemas']['QuickMakeResponse'];
type CourseSummaryResponse = components['schemas']['CourseSummaryResponse'];

// Library brand section color (WCAG AA-safe with white text — 5.3:1).
const ORANGE = '#a85500';
// Tool-card accent — the pricing/AI purple (AA-safe with white text — 5.79:1).
const PURPLE = '#7c3cc9';

// ── Studio config (emoji per slug; labels + taglines come from translations) ───

const STUDIOS: Array<{ slug: string; emoji: string }> = [
  { slug: 'craft', emoji: '🔨' },
  { slug: 'art', emoji: '🎨' },
  { slug: 'music', emoji: '🎵' },
  { slug: 'code', emoji: '💻' },
  { slug: 'science', emoji: '🧪' },
  { slug: 'nature', emoji: '🌿' },
];

const STUDIO_EMOJI: Record<string, string> = Object.fromEntries(
  STUDIOS.map((s) => [s.slug, s.emoji]),
);

// Contextual makes tied to the active mission (no per-mission endpoint yet).
const MISSION_MAKE_KEYS = [
  'mission_make_bridges',
  'mission_make_triangles',
  'mission_make_knots',
] as const;

const DIFFICULTY_KEYS: Record<number, string> = {
  1: 'difficulty_easy',
  2: 'difficulty_medium',
  3: 'difficulty_hard',
};
const MESS_KEYS: Record<number, string> = { 1: 'mess_tidy', 2: 'mess_some', 3: 'mess_messy' };

type LibraryTranslator = ReturnType<typeof useTranslations>;

// Slug -> translated label; unknown slugs fall back to the raw slug itself.
function studioLabel(t: LibraryTranslator, slug: string): string {
  return STUDIOS.some((s) => s.slug === slug) ? t(`studios.${slug}`) : slug;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const t = useTranslations('library');
  const locale = useLocale();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [studioCounts, setStudioCounts] = useState<StudioCountResponse[]>([]);
  const [courses, setCourses] = useState<CourseSummaryResponse[]>([]);
  const [quickMakes, setQuickMakes] = useState<QuickMakeResponse[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchStudios().catch(() => [] as StudioCountResponse[]),
      fetchCourses().catch(() => [] as CourseSummaryResponse[]),
      fetchQuickMakes({ per_page: 4 }).catch(
        () => ({ items: [] }) as unknown as QuickMakePageResponse,
      ),
    ]).then(([studios, cs, makes]) => {
      if (cancelled) return;
      setStudioCounts(studios as StudioCountResponse[]);
      setCourses(cs as CourseSummaryResponse[]);
      setQuickMakes((makes as QuickMakePageResponse).items ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Featured "continue" course: first course, progress from localStorage.
  const featured = courses[0] ?? null;
  const completedCount = (() => {
    if (!featured || typeof window === 'undefined') return 0;
    try {
      const raw = localStorage.getItem(`completedLessons_${featured.id}`);
      return raw ? (JSON.parse(raw) as string[]).length : 0;
    } catch {
      return 0;
    }
  })();

  return (
    <div
      data-testid="library-page"
      className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-6 md:px-8"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="text-center">
        <h1 className="font-display text-4xl font-bold text-ink md:text-5xl">
          {t('heading')}
        </h1>
        <p className="mx-auto mt-2 max-w-xl font-body text-lg font-semibold text-ink/70">
          {t('subheading')}
        </p>
      </header>

      {/* ── Continue ───────────────────────────────────────────────────────── */}
      <section aria-label={t('continue_heading')} className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold text-ink">{t('continue_label')}</h2>
        {loading ? (
          <div className="h-24 animate-pulse rounded-card bg-white" />
        ) : featured ? (
          <button
            type="button"
            data-testid="continue-course"
            onClick={() => router.push(`/library/courses/${featured.id}`)}
            className="flex items-center gap-4 rounded-[1.5rem] bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-library focus-visible:ring-offset-2"
          >
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-tint-cream text-3xl"
              aria-hidden="true"
            >
              {STUDIO_EMOJI[featured.studio] ?? '📚'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold text-ink">{featured.title}</p>
              {featured.price_toman != null && (
                <p className="w-fit rounded-pill bg-tint-lavender px-2.5 py-0.5 font-body text-xs font-bold text-[#7A3D8A]">
                  {t('special_price', { price: new Intl.NumberFormat(locale).format(featured.price_toman) })}
                </p>
              )}
              <p className="font-body text-sm text-ink/60">
                {t('with_creator', {
                  name: featured.creator_name,
                  studio: studioLabel(t, featured.studio),
                })}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(completedCount / Math.max(featured.lesson_count, 1)) * 100}%`,
                      backgroundColor: ORANGE,
                    }}
                  />
                </div>
                <span className="font-body text-xs font-semibold text-ink/50">
                  {completedCount}/{featured.lesson_count}
                </span>
              </div>
            </div>
            <span
              className="hidden shrink-0 items-center gap-1 rounded-pill px-5 py-2.5 font-display text-sm font-bold text-white sm:inline-flex"
              style={{ backgroundColor: ORANGE }}
            >
              {t('continue_btn')}
            </span>
          </button>
        ) : (
          <p className="font-body text-sm text-ink/50">
            {t('no_courses_empty')}
          </p>
        )}
      </section>

      {/* ── From your mission ──────────────────────────────────────────────── */}
      <section aria-label={t('mission_heading')} className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold text-ink">
          {t('mission_heading')}: <span className="text-challenge">{t('mission_title_demo')}</span>
        </h2>
        <div className="rounded-[1.5rem] bg-tint-blue p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {MISSION_MAKE_KEYS.map((key) => (
              <div key={key} className="flex flex-col gap-2 rounded-card bg-white p-3 shadow-sm">
                <div
                  className="h-20 rounded-xl bg-tint-cream"
                  aria-hidden="true"
                />
                <p className="font-display text-sm font-bold leading-snug text-ink">{t(key)}</p>
                <span className="inline-flex w-fit items-center gap-1 rounded-pill bg-white px-2.5 py-0.5 font-body text-xs font-semibold text-[#135A85]">
                  ⭐ {t('helps_challenge')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Studios ────────────────────────────────────────────────────────── */}
      <section aria-label={t('studios_label')} className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold text-ink">{t('studios_label')}</h2>
        <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-stretch">
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STUDIOS.map((s) => {
              const counts = studioCounts.find((c) => c.studio === s.slug);
              const makes = counts?.quick_make_count ?? 0;
              const courseN = counts?.course_count ?? 0;
              const label = t(`studios.${s.slug}`);
              return (
                <button
                  key={s.slug}
                  type="button"
                  data-testid="studio-card"
                  onClick={() => router.push(`/library?studio=${s.slug}`)}
                  aria-label={t('studio_card_aria', { label, makes, courses: courseN })}
                  className="flex min-h-[6.5rem] flex-col justify-center gap-1 rounded-[1.25rem] px-5 py-4 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ backgroundColor: ORANGE, ['--tw-ring-color' as string]: ORANGE }}
                >
                  <span className="font-display text-xl font-bold leading-tight">{label}</span>
                  <span className="flex items-center gap-1.5 font-body text-sm font-semibold text-white">
                    <span aria-hidden="true">{s.emoji}</span>
                    {makes > 0 || courseN > 0 ? (
                      <span>
                        {t('makes_count', { count: makes })}
                        {courseN > 0 ? ` · ${t('courses_count', { count: courseN })}` : ''}
                      </span>
                    ) : (
                      <span>{t(`studio_tagline_${s.slug}`)}</span>
                    )}
                  </span>
                </button>
              );
            })}
            {/* Machine Trainer — an on-device AI TOOL, not a content studio:
                purple (vs studio orange) and a direct route instead of a
                ?studio= filter. This is the classifier's standalone entry
                point now that it's out of the main nav. */}
            <button
              type="button"
              data-testid="tool-card-classifier"
              onClick={() => router.push('/studio/classify')}
              aria-label={t('machine_trainer_aria')}
              className="flex min-h-[6.5rem] flex-col justify-center gap-1 rounded-[1.25rem] px-5 py-4 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ backgroundColor: PURPLE, ['--tw-ring-color' as string]: PURPLE }}
            >
              <span className="font-display text-xl font-bold leading-tight">
                {t('machine_trainer')}
              </span>
              <span className="flex items-center gap-1.5 font-body text-sm font-semibold text-white">
                <span aria-hidden="true">🤖</span>
                <span>{t('machine_trainer_tagline')}</span>
              </span>
            </button>
            {/* Animation Studio — the second on-device tool, same anatomy as
                the Machine Trainer card. */}
            <button
              type="button"
              data-testid="tool-card-animation"
              onClick={() => router.push('/studio/animate')}
              aria-label={t('animation_studio_aria')}
              className="flex min-h-[6.5rem] flex-col justify-center gap-1 rounded-[1.25rem] px-5 py-4 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ backgroundColor: PURPLE, ['--tw-ring-color' as string]: PURPLE }}
            >
              <span className="font-display text-xl font-bold leading-tight">
                {t('animation_studio')}
              </span>
              <span className="flex items-center gap-1.5 font-body text-sm font-semibold text-white">
                <span aria-hidden="true">🎬</span>
                <span>{t('animation_studio_tagline')}</span>
              </span>
            </button>
            {/* Question Tree — the third on-device tool, same anatomy. */}
            <button
              type="button"
              data-testid="tool-card-qtree"
              onClick={() => router.push('/studio/question-tree')}
              aria-label={t('question_tree_aria')}
              className="flex min-h-[6.5rem] flex-col justify-center gap-1 rounded-[1.25rem] px-5 py-4 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ backgroundColor: PURPLE, ['--tw-ring-color' as string]: PURPLE }}
            >
              <span className="font-display text-xl font-bold leading-tight">
                {t('question_tree')}
              </span>
              <span className="flex items-center gap-1.5 font-body text-sm font-semibold text-white">
                <span aria-hidden="true">🌳</span>
                <span>{t('question_tree_tagline')}</span>
              </span>
            </button>
            {/* Reward Maze — the fourth on-device tool, same anatomy. */}
            <button
              type="button"
              data-testid="tool-card-maze"
              onClick={() => router.push('/studio/reward-maze')}
              aria-label={t('reward_maze_aria')}
              className="flex min-h-[6.5rem] flex-col justify-center gap-1 rounded-[1.25rem] px-5 py-4 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ backgroundColor: PURPLE, ['--tw-ring-color' as string]: PURPLE }}
            >
              <span className="font-display text-xl font-bold leading-tight">
                {t('reward_maze')}
              </span>
              <span className="flex items-center gap-1.5 font-body text-sm font-semibold text-white">
                <span aria-hidden="true">🐭</span>
                <span>{t('reward_maze_tagline')}</span>
              </span>
            </button>
          </div>
          <Image
            src="/kid/pointing-girl.png"
            alt=""
            aria-hidden="true"
            width={280}
            height={340}
            className="hidden h-64 w-auto shrink-0 select-none self-end object-contain lg:block"
          />
        </div>
      </section>

      {/* ── Quick makes ────────────────────────────────────────────────────── */}
      <section aria-label={t('quick_makes_heading')} className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold text-ink">{t('quick_makes_heading')}</h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-[1.25rem] bg-white" />
            ))}
          </div>
        ) : quickMakes.length === 0 ? (
          <p className="font-body text-sm text-ink/50">{t('no_quick_makes')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickMakes.map((m) => (
              <QuickMakeTile key={m.id} make={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Quick make tile ────────────────────────────────────────────────────────────

function QuickMakeTile({ make }: { make: QuickMakeResponse }) {
  const t = useTranslations('library');
  const emoji = STUDIO_EMOJI[make.studio] ?? '📚';
  return (
    <div
      data-testid="quick-make-tile"
      className="flex flex-col items-center gap-2 rounded-[1.25rem] px-3 pb-4 pt-14 text-center text-white"
      style={{ backgroundColor: ORANGE, position: 'relative' }}
    >
      {/* Circular photo placeholder (overlaps top) */}
      <span
        className="absolute -top-8 flex h-24 w-24 items-center justify-center rounded-full bg-tint-cream text-4xl shadow-md ring-4 ring-white"
        aria-hidden="true"
      >
        {emoji}
      </span>

      <span className="inline-flex items-center gap-1 rounded-pill bg-black/20 px-2.5 py-0.5 font-body text-xs font-bold">
        {emoji} {studioLabel(t, make.studio)}{' '}
        <span dir="ltr">{t('xp_reward', { xp: make.xp_reward })}</span>
      </span>
      <p className="font-display text-base font-bold leading-tight">{make.title}</p>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="rounded-pill bg-black/20 px-2 py-0.5 font-body text-[11px] font-semibold">
          {t(DIFFICULTY_KEYS[make.difficulty] ?? 'difficulty_easy')}
        </span>
        <span className="rounded-pill bg-black/20 px-2 py-0.5 font-body text-[11px] font-semibold">
          {t('time_min', { min: make.time_minutes })}
        </span>
        <span className="rounded-pill bg-black/20 px-2 py-0.5 font-body text-[11px] font-semibold">
          {t(MESS_KEYS[make.mess_level] ?? 'mess_tidy')}
        </span>
      </div>
      {make.materials.length > 0 && (
        <p className="font-body text-xs text-white">{make.materials.join(' + ')}</p>
      )}

      <span className="mt-1 inline-flex items-center gap-1 rounded-pill bg-white px-4 py-1.5 font-display text-sm font-bold text-library">
        ▶ {t('lesson_watch')}
      </span>
      {make.ai_generated && (
        <span className="font-body text-[10px] font-semibold text-white">{t('ai_assisted')}</span>
      )}
    </div>
  );
}
