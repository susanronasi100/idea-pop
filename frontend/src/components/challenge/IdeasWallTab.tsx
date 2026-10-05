'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { components } from '@/lib/api/schema';
import { fetchIdeas, reactToIdea, remixIdea } from '@/lib/api/client';
import IdeaCard from './IdeaCard';
import { btnSecondary } from '@/components/challenge/buttons';

type IdeaWallEntry = components['schemas']['IdeaWallEntry'];

interface IdeasWallTabProps {
  challengeId: string;
  ageMode: 'young' | 'older';
  wallUnlocked: boolean;
  onWriteMyIdea: () => void;
}

type Sort = 'newest' | 'most_remixed';

export default function IdeasWallTab({
  challengeId,
  ageMode,
  wallUnlocked,
  onWriteMyIdea,
}: IdeasWallTabProps) {
  const t = useTranslations('mission');
  const tWall = useTranslations('ideas_wall');
  const [ideas, setIdeas] = useState<IdeaWallEntry[]>([]);
  const [sort, setSort] = useState<Sort>('newest');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<boolean>(false);
  const [remixingId, setRemixingId] = useState<string | null>(null);
  const [restrictedError, setRestrictedError] = useState(false);
  const [remixToast, setRemixToast] = useState(false);

  useEffect(() => {
    if (!wallUnlocked) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(false);
      try {
        const data = await fetchIdeas(challengeId, sort);
        if (!cancelled) setIdeas(data);
      } catch (err) {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [wallUnlocked, challengeId, sort]);

  async function handleReact(ideaId: string, reaction: 'clap' | 'star' | 'lightbulb') {
    // Optimistic update
    setIdeas((prev) =>
      prev.map((idea) => {
        if (idea.id !== ideaId) return idea;
        const countKey = `${reaction}_count` as keyof IdeaWallEntry;
        return { ...idea, [countKey]: (idea[countKey] as number) + 1 };
      })
    );

    try {
      await reactToIdea(ideaId, reaction);
    } catch {
      // Roll back optimistic update on failure
      setIdeas((prev) =>
        prev.map((idea) => {
          if (idea.id !== ideaId) return idea;
          const countKey = `${reaction}_count` as keyof IdeaWallEntry;
          return { ...idea, [countKey]: (idea[countKey] as number) - 1 };
        })
      );
    }
  }

  async function handleRemix(ideaId: string) {
    setRemixingId(ideaId);
    setRestrictedError(false);

    try {
      await remixIdea(ideaId);
      setRemixToast(true);
      setTimeout(() => setRemixToast(false), 3000);
    } catch (err: unknown) {
      if (err instanceof Error && (err as Error & { code?: string }).code === 'restricted') {
        setRestrictedError(true);
      }
    } finally {
      setRemixingId(null);
    }
  }

  // LOCKED STATE
  if (!wallUnlocked) {
    return (
      <div className="flex justify-center items-center min-h-[300px] px-4">
        <div
          className="bg-white rounded-card shadow-sm p-6 border border-ink/10 max-w-sm w-full text-center flex flex-col gap-4"
          data-testid="wall-locked"
        >
          <p className="text-4xl">🔒</p>
          <h2 className="font-display text-challenge text-ink">{tWall('locked_heading')}</h2>
          <p className="font-body text-sm text-ink/50">
            {tWall('locked_body')}
          </p>
          <p className="font-body text-xs text-ink/50">
            {tWall('safety_note')}
          </p>
          <button
            type="button"
            onClick={onWriteMyIdea}
            data-testid="write-my-idea-cta"
            className={`${btnSecondary} mt-2`}
          >
            {tWall('locked_cta')}
          </button>
        </div>
      </div>
    );
  }

  // UNLOCKED STATE
  return (
    <div className="flex flex-col gap-4 px-4 pb-8" data-testid="wall-unlocked">
      {/* Safety note banner */}
      <div
        className="bg-tint-blue rounded-card px-4 py-2.5 font-body text-sm text-ink border border-ink/10"
        data-testid="safety-note"
      >
        {tWall('safety_note')}
      </div>

      {/* Restricted error banner */}
      {restrictedError && (
        <div
          className="bg-white rounded-card px-4 py-2.5 font-body text-sm text-ink border border-ink/10"
          data-testid="restricted-banner"
        >
          {tWall('restricted_share')}
        </div>
      )}

      {/* Remix toast */}
      {remixToast && (
        <div className="bg-white rounded-card px-4 py-2.5 font-body text-sm text-ink border border-ink/10 shadow-sm">
          {t('remix_toast')}
        </div>
      )}

      {/* Sort toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSort('newest')}
          data-testid="sort-newest"
          className={`px-4 py-1.5 rounded-full font-body text-sm border transition-colors ${
            sort === 'newest'
              ? 'bg-tint-blue text-ink border-ink/10'
              : 'bg-white text-ink/50 border-ink/10 hover:bg-tint-blue hover:text-ink'
          }`}
        >
          {tWall('sort_newest')}
        </button>
        <button
          type="button"
          onClick={() => setSort('most_remixed')}
          data-testid="sort-remixed"
          className={`px-4 py-1.5 rounded-full font-body text-sm border transition-colors ${
            sort === 'most_remixed'
              ? 'bg-tint-blue text-ink border-ink/10'
              : 'bg-white text-ink/50 border-ink/10 hover:bg-tint-blue hover:text-ink'
          }`}
        >
          {tWall('sort_remixed')}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div
          className="flex justify-center py-10"
          data-testid="wall-loading"
        >
          <span className="inline-block w-8 h-8 border-4 border-tint-blue border-t-ink rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div
          className="font-body text-sm text-ink/50 text-center py-6"
          data-testid="wall-error"
        >
          {t('wall_load_error')}
        </div>
      )}

      {/* Ideas grid */}
      {!loading && !error && (
        <div className="flex flex-col gap-4">
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onReact={handleReact}
              onRemix={handleRemix}
              remixing={remixingId === idea.id}
            />
          ))}
          {ideas.length === 0 && (
            <p className="font-body text-sm text-ink/50 text-center py-6">
              {t('wall_empty')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
