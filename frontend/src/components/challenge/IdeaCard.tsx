'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { components } from '@/lib/api/schema';

type IdeaWallEntry = components['schemas']['IdeaWallEntry'];

interface IdeaCardProps {
  idea: IdeaWallEntry;
  onReact: (ideaId: string, reaction: 'clap' | 'star' | 'lightbulb') => void;
  onRemix: (ideaId: string) => void;
  remixing?: boolean;
}

function resolveAvatar(avatarId: string): string {
  if (!avatarId) return '🦊';
  const first = [...avatarId][0];
  // Emoji code points start above U+00FF
  if (first && first.codePointAt(0)! > 255) return first;
  return '🦊';
}

export default function IdeaCard({ idea, onReact, onRemix, remixing = false }: IdeaCardProps) {
  const t = useTranslations('mission');
  const avatar = resolveAvatar(idea.author_avatar_id);

  return (
    <div
      className="bg-white rounded-card shadow-sm p-4 flex flex-col gap-3 border border-ink/10"
      data-testid="idea-card"
    >
      {/* Top row: avatar + nickname */}
      <div className="flex items-center gap-2">
        <span
          className="flex items-center justify-center w-9 h-9 rounded-full bg-tint-blue text-xl select-none"
          aria-hidden="true"
        >
          {avatar}
        </span>
        <span className="font-body font-bold text-sm text-ink">{idea.author_nickname}</span>
      </div>

      {/* Project photo */}
      {idea.project_photo_url && (
        <div className="relative w-full h-40 rounded-card overflow-hidden mb-2">
          <Image
            src={idea.project_photo_url}
            alt={t('project_photo_alt', { nickname: idea.author_nickname })}
            fill
            className="object-cover"
          />
        </div>
      )}

      {/* Caption */}
      {idea.caption && (
        <p className="font-body text-sm text-ink">{idea.caption}</p>
      )}

      {/* Reactions + remix */}
      <div className="flex items-center gap-2 flex-wrap mt-1">
        <button
          type="button"
          onClick={() => onReact(idea.id, 'clap')}
          data-testid="react-clap"
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-tint-blue text-ink text-sm font-body hover:opacity-80 transition-opacity"
        >
          👏 <span>{idea.clap_count}</span>
        </button>

        <button
          type="button"
          onClick={() => onReact(idea.id, 'star')}
          data-testid="react-star"
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-tint-blue text-ink text-sm font-body hover:opacity-80 transition-opacity"
        >
          ⭐ <span>{idea.star_count}</span>
        </button>

        <button
          type="button"
          onClick={() => onReact(idea.id, 'lightbulb')}
          data-testid="react-lightbulb"
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-tint-blue text-ink text-sm font-body hover:opacity-80 transition-opacity"
        >
          💡 <span>{idea.lightbulb_count}</span>
        </button>

        <button
          type="button"
          onClick={() => onRemix(idea.id)}
          data-testid="remix-btn"
          disabled={remixing}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-ink/10 text-ink text-sm font-body hover:bg-tint-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
        >
          ↻ {remixing ? t('remixing') : t('remix_idea')}
        </button>
      </div>
    </div>
  );
}
