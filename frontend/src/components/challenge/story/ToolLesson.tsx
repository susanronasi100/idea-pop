'use client';

import { useTranslations } from 'next-intl';
import { Popi, RewardPop, backClass, pillCtaClass } from './StoryBits';
import type { MissionStory } from './types';
import type { BadgeKey, MissionGame, GameUpdate } from './useMissionGame';

interface Props {
  story: MissionStory;
  game: MissionGame;
  update: GameUpdate;
  award: (b: BadgeKey) => void;
  onNext: () => void;
  onBack: () => void;
}

const PHASES = ['learn', 'see', 'try'] as const;

/**
 * The creativity-tool power-up (chapter 5½), taught the easy way in three
 * moves: Learn it (what each piece means), See it (Popi tries it on an
 * everyday object first) and Try it (finish one sentence per piece). A
 * mission teaches only a few pieces; the rest show locked for later missions.
 */
export default function ToolLesson({ story, game, update, award, onNext, onBack }: Props) {
  const t = useTranslations('story');
  const tool = story.tool;
  const phase = game.toolPhase;
  const lit = tool.parts.filter((p) => (game.toolAnswers[p.key] ?? '').trim()).length;
  const allLit = lit === tool.parts.length;

  function setAnswer(key: string, value: string) {
    update((g) => {
      const toolAnswers = { ...g.toolAnswers, [key]: value };
      const done = tool.parts.every((p) => (toolAnswers[p.key] ?? '').trim());
      const badges: BadgeKey[] = done && !g.badges.includes('tool') ? [...g.badges, 'tool'] : g.badges;
      return { toolAnswers, badges };
    });
  }

  return (
    <div data-testid="tool-lesson" className="flex flex-col gap-5 py-4">

      <div role="tablist" aria-label={t('tool_steps_aria')} className="flex gap-1.5 rounded-pill bg-white p-1">
        {PHASES.map((ph, i) => (
          <button
            key={ph}
            type="button"
            role="tab"
            aria-selected={phase === i}
            data-testid={`tool-phase-${ph}`}
            disabled={i > phase && !(i === 2 && game.seen.length === tool.parts.length)}
            onClick={() => update({ toolPhase: i as 0 | 1 | 2 })}
            className={[
              'flex-1 rounded-pill px-2 py-2 font-body text-sm font-bold transition-colors disabled:opacity-40',
              phase === i ? 'bg-challenge text-white' : i < phase ? 'text-explore' : 'text-ink/60',
            ].join(' ')}
          >
            {i < phase ? '✓' : i + 1} {t(`tool_${ph}`)}
          </button>
        ))}
      </div>

      {phase === 0 && (
        <>
          <Popi label={t('popi_power_up')} text={tool.intro} />
          <div className="flex flex-col gap-3 rounded-card bg-white p-5">
            <p className="font-body font-bold text-xs text-challenge">{t('tool_what_is', { tool: tool.name })}</p>
            <div className="flex flex-wrap justify-center gap-1.5" aria-label={t('tool_pieces_aria')}>
              {tool.parts.map((p, i) => (
                <span
                  key={p.key}
                  className="story-pop flex h-12 min-w-10 items-center justify-center rounded-xl bg-challenge px-2 font-display text-xl text-white"
                  style={{ animationDelay: `${i * 0.15}s` }}
                >
                  {p.key}
                </span>
              ))}
              {tool.locked.map((k) => (
                <span key={k} className="flex h-12 min-w-10 items-center justify-center rounded-xl bg-ink/10 px-2 text-sm" aria-label={t('tool_locked', { piece: k })}>
                  🔒
                </span>
              ))}
            </div>
            {tool.locked.length > 0 && <p className="text-center font-body text-xs text-ink/60">{t('tool_later')}</p>}
            {tool.parts.map((p) => (
              <div key={p.key} className="flex items-start gap-2">
                <span className="shrink-0 rounded-md bg-tint-lime px-2 py-1 font-body text-[11px] font-bold uppercase text-explore">{p.key}</span>
                <p className="font-body text-sm text-ink"><b>{p.name}:</b> {p.what}</p>
              </div>
            ))}
          </div>
          <button type="button" data-testid="tool-to-see" onClick={() => update({ toolPhase: 1 })} className={pillCtaClass}>
            {t('tool_show_example')}
          </button>
        </>
      )}

      {phase === 1 && (
        <>
          <Popi label={t('popi_power_up')} text={t('tool_see_intro', { object: tool.example_object })} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tool.parts.map((p, i) => {
              const open = game.seen.includes(i);
              return (
                <button
                  key={p.key}
                  type="button"
                  data-testid={`tool-example-${i}`}
                  data-open={open}
                  onClick={() => !open && update((g) => ({ seen: [...g.seen, i] }))}
                  className="story-flip min-h-[150px] rounded-card text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge"
                >
                  <span className="story-flip-inner block min-h-[150px]">
                    <span className="story-face flex flex-col items-center justify-center gap-1 rounded-card bg-white p-4 text-center shadow-sm">
                      <span className="font-display text-4xl text-challenge">{p.key}</span>
                      <span className="font-body font-bold text-sm text-ink">{p.name}</span>
                      <span className="font-body text-xs text-ink/60">{t('tap_to_see')}</span>
                    </span>
                    <span className="story-face story-back flex flex-col justify-center gap-1.5 rounded-card bg-white p-4 shadow-sm">
                      <span className="font-body font-bold text-xs text-explore">{p.name}</span>
                      <span className="font-body text-sm text-ink">{p.example}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            data-testid="tool-to-try"
            disabled={game.seen.length < tool.parts.length}
            onClick={() => update({ toolPhase: 2 })}
            className={pillCtaClass}
          >
            {t('tool_my_turn')}
          </button>
        </>
      )}

      {phase === 2 && (
        <>
          <Popi label={t('popi_power_up')} text={t('tool_try_intro', { count: tool.parts.length })} />
          <div className="flex flex-col gap-3 rounded-card bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="font-body font-bold text-xs text-challenge">{t('tool_try_title', { tool: tool.name })}</p>
              <b className="font-body text-sm tabular-nums">{t('tool_lit', { lit, total: tool.parts.length })}</b>
            </div>
            <div className="h-3 overflow-hidden rounded-pill bg-ink/10" role="progressbar" aria-valuemin={0} aria-valuemax={tool.parts.length} aria-valuenow={lit}>
              <i className="block h-full bg-gradient-to-r from-challenge to-[#5cc7ee] transition-all duration-500" style={{ width: `${(lit / tool.parts.length) * 100}%` }} />
            </div>
            {tool.parts.map((p) => {
              const value = game.toolAnswers[p.key] ?? '';
              const on = value.trim().length > 0;
              return (
                <div key={p.key} className={`flex flex-col gap-1.5 rounded-2xl p-3 transition-colors ${on ? 'bg-[#eaf7ff]' : 'bg-tint-blue'}`}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-body font-bold text-base text-challenge">
                      <span className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-base ${on ? 'story-pop bg-challenge text-white' : 'bg-white text-ink/30'}`}>{p.key}</span>
                      {p.name}
                    </span>
                    <button
                      type="button"
                      data-testid={`tool-fav-${p.key}`}
                      disabled={!on}
                      aria-pressed={game.favourite === p.key}
                      aria-label={t('tool_fav_aria')}
                      onClick={() => update({ favourite: p.key })}
                      className={`text-2xl transition-all ${game.favourite === p.key ? 'story-pop' : 'opacity-40 grayscale'}`}
                    >
                      ⭐
                    </button>
                  </div>
                  <label htmlFor={`tool-${p.key}`} className="font-body text-sm font-semibold text-ink">{p.starter}</label>
                  <textarea
                    id={`tool-${p.key}`}
                    data-testid={`tool-answer-${p.key}`}
                    rows={2}
                    maxLength={200}
                    value={value}
                    placeholder={t('tool_placeholder')}
                    onChange={(e) => setAnswer(p.key, e.target.value)}
                    className="w-full rounded-xl border-2 border-ink/10 bg-white px-3 py-2 font-body text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge"
                  />
                </div>
              );
            })}
            <p className="font-body text-sm text-ink/60" aria-live="polite">
              {allLit ? t('tool_all_done') : t('tool_more', { count: tool.parts.length - lit })}
            </p>
            {allLit && <RewardPop text={t('badge_earned', { badge: tool.badge })} />}
          </div>
          <button type="button" data-testid="tool-done" disabled={!allLit} onClick={() => { award('tool'); onNext(); }} className={pillCtaClass}>
            {t('tool_to_sketch')}
          </button>
        </>
      )}

      <button type="button" onClick={phase > 0 ? () => update({ toolPhase: (phase - 1) as 0 | 1 }) : onBack} className={backClass}>
        {t('back')}
      </button>
    </div>
  );
}
