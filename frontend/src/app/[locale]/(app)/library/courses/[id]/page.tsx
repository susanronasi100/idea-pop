'use client';

import { use, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { fetchCourse, fetchCreator } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { useXpToast } from '@/lib/hooks/useXpToast';
import LessonVideoPlayer from '@/components/library/LessonVideoPlayer';
import XpBurst from '@/components/explore/XpBurst';

type CourseDetailResponse = components['schemas']['CourseDetailResponse'];
type LessonResponse = components['schemas']['LessonResponse'];
type CreatorResponse = components['schemas']['CreatorResponse'];
type XpAwardResponse = components['schemas']['XpAwardResponse'];

// Library brand section color (WCAG AA-safe with white text — 5.3:1).
const ORANGE = '#a85500';

// Studio slug -> emoji; labels come from the `library.studios` translations.
const STUDIO_EMOJI: Record<string, string> = {
  craft: '🔨',
  art: '🎨',
  music: '🎵',
  code: '💻',
  science: '🧪',
  nature: '🌿',
};

const DIFFICULTY_KEYS: Record<number, string> = {
  1: 'difficulty_easy',
  2: 'difficulty_medium',
  3: 'difficulty_hard',
};

const LS_KEY = (courseId: string) => `completedLessons_${courseId}`;

function loadCompleted(courseId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(LS_KEY(courseId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveCompleted(courseId: string, ids: Set<string>) {
  try {
    localStorage.setItem(LS_KEY(courseId), JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore */
  }
}

interface PageParams {
  locale: string;
  id: string;
}

export default function CourseDetailPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  // Client component: params is a promise in Next 15, unwrapped with use().
  const { id } = use(params);
  const t = useTranslations('library');
  const locale = useLocale();
  const tExplore = useTranslations('explore');
  const xpToast = useXpToast();

  const [course, setCourse] = useState<CourseDetailResponse | null>(null);
  const [creator, setCreator] = useState<CreatorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCourse(id)
      .then(async (data) => {
        if (cancelled) return;
        const c = data as CourseDetailResponse;
        setCourse(c);
        setCompleted(loadCompleted(id));
        if (c.creator_id) {
          const cr = await fetchCreator(c.creator_id).catch(() => null);
          if (!cancelled) setCreator(cr as CreatorResponse | null);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function handleLessonComplete(award: XpAwardResponse) {
    if (!activeLessonId) return;
    const updated = new Set(completed).add(activeLessonId);
    setCompleted(updated);
    saveCompleted(id, updated);
    setActiveLessonId(null);
    xpToast.show(award);
  }

  const activeLesson = course?.lessons.find((l) => l.id === activeLessonId) ?? null;

  const lessons = course?.lessons ?? [];
  const doneCount = lessons.filter((l) => completed.has(l.id)).length;
  // First not-yet-completed lesson = the "now" lesson (the current frontier).
  const currentIdx = lessons.findIndex((l) => !completed.has(l.id));
  // Unknown studio slugs fall back to the raw slug itself.
  const studioMeta = course
    ? {
        label: STUDIO_EMOJI[course.studio] ? t(`studios.${course.studio}`) : course.studio,
        emoji: STUDIO_EMOJI[course.studio] ?? '📚',
      }
    : null;

  return (
    <div
      data-testid="course-page"
      className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 md:px-8"
    >
      {/* Breadcrumb */}
      <nav aria-label={t('breadcrumb_aria')} className="font-body text-sm text-ink/60">
        <Link href="/library" className="rounded hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-library">
          {t('breadcrumb_library')}
        </Link>
        {studioMeta && (
          <span>
            {' '}
            → <span aria-hidden="true">{studioMeta.emoji}</span> {studioMeta.label}
          </span>
        )}
      </nav>

      {loading && (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label={t('loading_course_aria')}>
          <div className="h-24 animate-pulse rounded-card bg-white" />
          <div className="h-16 animate-pulse rounded-card bg-white" />
          <div className="h-16 animate-pulse rounded-card bg-white" />
        </div>
      )}

      {!loading && !course && (
        <p className="font-body text-sm text-ink/50">{t('course_not_found')}</p>
      )}

      {!loading && course && studioMeta && (
        <>
          {/* Header */}
          <header className="flex flex-col gap-4 sm:flex-row">
            <span
              className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-tint-cream text-5xl"
              aria-hidden="true"
            >
              {studioMeta.emoji}
            </span>
            <div className="flex flex-1 flex-col gap-2">
              <h1 className="font-display text-3xl font-bold text-ink">{course.title}</h1>
              {creator && (
                <p className="w-fit rounded-pill bg-tint-lavender px-3 py-1 font-body text-sm font-semibold text-[#7A3D8A]">
                  {t('with_instructor', { name: creator.display_name })}
                  {creator.bio ? ` · ${creator.bio.split('.')[0]}` : ''}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {course.price_toman != null && (
                  // A special expert course, sold on its own outside the monthly plans (see the pricing page).
                  <span
                    data-testid="course-special-price"
                    className="rounded-pill bg-tint-lavender px-3 py-1 font-body text-sm font-bold text-[#7A3D8A]"
                  >
                    {t('special_price', { price: new Intl.NumberFormat(locale).format(course.price_toman) })}
                  </span>
                )}
                <MetaPill>{t('course_lessons', { count: lessons.length })}</MetaPill>
                <MetaPill>⭐ {t(DIFFICULTY_KEYS[course.difficulty] ?? 'difficulty_easy')}</MetaPill>
                <MetaPill>{t('age_plus', { age: course.age_min })}</MetaPill>
                <MetaPill><span dir="ltr">{t('xp_per_lesson', { xp: lessons[0]?.xp_reward ?? 10 })}</span></MetaPill>
                {course.materials.length > 0 && (
                  <MetaPill>🏠 {course.materials.join(' + ')}</MetaPill>
                )}
              </div>
              {currentIdx >= 0 && (
                <button
                  type="button"
                  data-testid="continue-lesson-btn"
                  onClick={() => setActiveLessonId(lessons[currentIdx].id)}
                  className="mt-1 w-fit rounded-pill px-6 py-2.5 font-display text-sm font-bold text-white transition-all hover:brightness-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ backgroundColor: ORANGE, ['--tw-ring-color' as string]: ORANGE }}
                >
                  {t('continue_lesson_btn', { n: lessons[currentIdx].ordinal })}
                </button>
              )}
            </div>
          </header>

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/10">
              <div
                data-testid="course-progress"
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(doneCount / Math.max(lessons.length, 1)) * 100}%`,
                  backgroundColor: ORANGE,
                }}
              />
            </div>
            <span className="font-display text-sm font-bold text-ink/70">
              {t('lessons_done', { done: doneCount, total: lessons.length })}
            </span>
          </div>

          {/* Lessons */}
          <ul className="flex flex-col gap-2.5" aria-label={t('lessons_aria')}>
            {lessons.map((lesson, i) => {
              const isDone = completed.has(lesson.id);
              const isNow = !isDone && i === currentIdx;
              const isProject = i === lessons.length - 1;
              const isLocked = !isDone && !isNow && !isProject;
              return (
                <LessonItem
                  key={lesson.id}
                  lesson={lesson}
                  state={isDone ? 'done' : isProject ? 'project' : isNow ? 'now' : isLocked ? 'locked' : 'open'}
                  onWatch={() => setActiveLessonId(lesson.id)}
                />
              );
            })}
          </ul>

          {/* Instructor */}
          {creator && (
            <div className="flex items-start gap-3 rounded-[1.25rem] bg-black/[0.03] p-4">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint-lavender text-xl"
                aria-hidden="true"
              >
                🧑‍🏫
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="font-display text-sm font-bold text-ink">{creator.display_name}</p>
                <p className="font-body text-sm text-ink/60">{creator.bio}</p>
              </div>
            </div>
          )}

          {/* Cross-links */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/explore"
              className="rounded-[1.25rem] bg-tint-lime p-4 font-display text-sm font-bold text-explore transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-explore"
            >
              🌿 {t('pairs_with_exploring')}
              <br />
              <span className="text-base">{tExplore('categories.masters_of_disguise')} →</span>
            </Link>
            <Link
              href="/challenges"
              className="rounded-[1.25rem] bg-tint-blue p-4 font-display text-sm font-bold text-[#135A85] transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge"
            >
              🧱 {t('helps_the_challenge')}
              <br />
              <span className="text-base">{t('challenge_link_demo')} →</span>
            </Link>
          </div>
        </>
      )}

      {/* Lesson video overlay */}
      {activeLesson && course && (
        <LessonVideoPlayer
          lesson={activeLesson}
          courseTitle={course.title}
          onComplete={handleLessonComplete}
          onClose={() => setActiveLessonId(null)}
        />
      )}

      {/* XP burst toast */}
      {xpToast.visible && xpToast.award && (
        <XpBurst award={xpToast.award} stickerEmoji="🏆" onDismiss={xpToast.dismiss} />
      )}
    </div>
  );
}

// ── Meta pill ──────────────────────────────────────────────────────────────────

function MetaPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-pill bg-black/[0.05] px-3 py-1 font-body text-xs font-semibold text-ink/70">
      {children}
    </span>
  );
}

// ── Lesson item ────────────────────────────────────────────────────────────────

type LessonState = 'done' | 'now' | 'locked' | 'project' | 'open';

function LessonItem({
  lesson,
  state,
  onWatch,
}: {
  lesson: LessonResponse;
  state: LessonState;
  onWatch: () => void;
}) {
  const t = useTranslations('library');
  const durationMin = Math.round(lesson.duration_s / 60);
  const clickable = state !== 'locked';

  if (state === 'project') {
    return (
      <li>
        <button
          type="button"
          data-testid={`lesson-row-${lesson.id}`}
          onClick={onWatch}
          className="flex w-full items-center gap-3 rounded-[1rem] border-2 border-explore bg-tint-lime px-4 py-3 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-explore"
        >
          <span className="text-xl" aria-hidden="true">🎉</span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold text-ink">
              {lesson.ordinal} · {lesson.title}
            </p>
            <p className="font-body text-xs text-ink/60">
              {t('project_lesson_hint', { xp: lesson.xp_reward })}
            </p>
          </div>
          <span className="shrink-0 font-body text-xs font-bold text-explore">
            {t('your_turn')}
          </span>
        </button>
      </li>
    );
  }

  const content = (
    <>
      {/* Status marker */}
      <span
        className={[
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs',
          state === 'done'
            ? 'bg-explore text-white'
            : state === 'now'
              ? 'text-white'
              : 'bg-black/10 text-ink/40',
        ].join(' ')}
        style={state === 'now' ? { backgroundColor: ORANGE } : undefined}
        aria-hidden="true"
      >
        {state === 'done' ? '✓' : state === 'locked' ? '🔒' : '▶'}
      </span>
      <p
        className={[
          'min-w-0 flex-1 font-display text-sm font-bold',
          state === 'locked' ? 'text-ink/70' : 'text-ink',
        ].join(' ')}
      >
        {lesson.ordinal} · {lesson.title}
      </p>
      {state === 'now' && (
        <span
          className="shrink-0 rounded-pill px-2 py-0.5 font-body text-[11px] font-bold text-white"
          style={{ backgroundColor: ORANGE }}
        >
          {t('now_pill')}
        </span>
      )}
      <span className="shrink-0 font-body text-xs text-ink/70">
        {t('time_min', { min: durationMin })}
      </span>
      <span
        className={[
          'shrink-0 font-body text-xs font-semibold',
          state === 'done' ? 'text-explore' : 'text-ink/70',
        ].join(' ')}
      >
        <span dir="ltr">{t('xp_plus', { xp: lesson.xp_reward })}</span>
        {state === 'done' ? ' ✓' : ''}
      </span>
    </>
  );

  return (
    <li>
      {clickable ? (
        <button
          type="button"
          data-testid={`lesson-row-${lesson.id}`}
          onClick={onWatch}
          aria-label={t('lesson_aria', { n: lesson.ordinal, title: lesson.title })}
          className={[
            'flex w-full items-center gap-3 rounded-[1rem] bg-white px-4 py-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-library',
            state === 'now' ? 'ring-2 ring-[color:var(--now)]' : '',
          ].join(' ')}
          style={state === 'now' ? ({ ['--now' as string]: ORANGE }) : undefined}
        >
          {content}
        </button>
      ) : (
        <div
          data-testid={`lesson-row-${lesson.id}`}
          className="flex items-center gap-3 rounded-[1rem] bg-black/[0.03] px-4 py-3"
          aria-label={t('lesson_locked_aria', { n: lesson.ordinal, title: lesson.title })}
        >
          {content}
        </div>
      )}
    </li>
  );
}
