'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import CaptureCard, { type CaptureData } from './CaptureCard';
import ToolSelector, { isToolKey } from './tool/ToolSelector';
import { createProject } from '@/lib/api/client';
import { GAME_BY_SLUG } from './gameEmbeds';
import { btnPrimary, btnText } from '@/components/challenge/buttons';

type ChallengeDetail = import('@/lib/api/schema').components['schemas']['ChallengeDetail'];

interface StepSketchProps {
  challenge: ChallengeDetail;
  ageMode: 'young' | 'older';
  onNext: (projectId: string | null) => void;
  onBack: () => void;
  /** Story missions teach their tool in the chapter-5½ power-up instead. */
  hideTools?: boolean;
}

export default function StepSketch({ challenge, ageMode, onNext, onBack, hideTools = false }: StepSketchProps) {
  const t = useTranslations('mission');
  const game = GAME_BY_SLUG[challenge.slug];
  // The hook must run unconditionally; the namespace is only read when a game exists.
  const tg = useTranslations(game?.i18nNs ?? 'qtree');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(data: CaptureData) {
    setSubmitting(true);
    try {
      const project = await createProject({
        title: data.title || t('default_sketch_title'),
        what_i_made: data.what_i_made,
        what_i_used: data.what_i_used,
        what_was_hard: '',
        what_id_improve: '',
        challenge_id: challenge.id,
        step_type: 'sketch',
      });
      onNext(project.id);
    } catch {
      onNext(null);
    } finally {
      setSubmitting(false);
    }
  }

  /** Game missions: the "sketch" is the game state itself — save its text
   *  snapshot as the project (feeds the celebrate/Ideas-Wall flow) instead of
   *  a photo. Never blocks progression. */
  async function handleGameContinue() {
    if (!game) return;
    setSubmitting(true);
    const snapshot = game.buildSnapshot(tg);
    try {
      const project = await createProject({
        title: tg('project_title'),
        what_i_made: snapshot ?? tg('project_untried'),
        what_i_used: '',
        what_was_hard: '',
        what_id_improve: '',
        challenge_id: challenge.id,
        step_type: 'sketch',
      });
      onNext(project.id);
    } catch {
      onNext(null);
    } finally {
      setSubmitting(false);
    }
  }


  // Real DTO tools are {kind, age_mode} pairs; pick this kid's age mode,
  // falling back to every authored kind if none match.
  const allTools = challenge.tools ?? [];
  const forAge = allTools.filter((t) => t.age_mode === ageMode).map((t) => t.kind);
  // Kinds without a tool UI yet (e.g. brainstorm) are skipped.
  const toolKinds = [...new Set(forAge.length > 0 ? forAge : allTools.map((t) => t.kind))].filter(isToolKey);

  return (
    <div data-testid="step-sketch" className="flex flex-col gap-4 px-4 py-6">
      <div>
        <h2 className="font-display text-2xl text-challenge">{t('sketch_heading')}</h2>
        <p className="mt-1 font-body text-lg font-semibold leading-snug text-ink">
          {/* Story missions ask the kid for their own idea and never list answers (TEMP rule 36). */}
          {challenge.story
            ? t('sketch_prompt_story', { hero: challenge.story.hero.name })
            : challenge.sketch_prompt?.trim() || t('sketch_prompt_fallback')}
        </p>
        {/* The paper-and-photo instruction contradicts the on-screen games. */}
        {!game && (
          <p
            data-testid="sketch-instruction"
            className="mt-2 rounded-card bg-tint-blue px-3 py-2 font-body text-sm text-ink/80"
          >
            ✏️ {t('sketch_instruction')}
          </p>
        )}
        {!challenge.story && challenge.sketch_guidance?.trim() && (
          <p
            data-testid="sketch-guidance"
            className="mt-2 rounded-card bg-tint-cream px-3 py-2 font-body text-sm text-ink/70"
          >
            💡 {challenge.sketch_guidance}
          </p>
        )}
      </div>

      {/* Creativity tools accordion — only when challenge includes tools */}
      {!hideTools && toolKinds.length > 0 && (
        <ToolSelector
          tools={toolKinds}
          topic={challenge.title}
          ageMode={ageMode}
        />
      )}

      {game ? (
        <>
          {/* The plan IS the game state — no photo capture here. */}
          <game.Panel defaultOpen />
          <button
            type="button"
            data-testid={`${game.testIdPrefix}-sketch-continue`}
            onClick={() => void handleGameContinue()}
            disabled={submitting}
            className={`${btnPrimary} w-full`}
          >
            {submitting ? t('saving') : tg('sketch_continue')}
          </button>
        </>
      ) : (
        <CaptureCard
          showExtendedFields={false}
          photoPrompt={t('sketch_photo_prompt')}
          submitLabel={t('sketch_submit')}
          ageMode={ageMode}
          onSubmit={handleSubmit}
          submitting={submitting}
          helper={{ challengeId: challenge.id, step: 6 }}
        />
      )}

      <button
        type="button"
        onClick={onBack}
        className={`${btnText} mt-2 self-start`}
      >
        {t('back')}
      </button>
    </div>
  );
}
