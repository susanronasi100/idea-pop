'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

/** The prompt-card tools: each is a short list of labelled boxes to fill in. */
export const PROMPT_TOOLS = {
  brainstorm: ['quantity', 'wild', 'build', 'pick'],
  empathy_map: ['says', 'thinks', 'does', 'feels'],
  how_might_we: ['user', 'need', 'insight', 'hmw'],
  like_wish_what_if: ['like', 'wish', 'what_if'],
  nature_translator: ['function', 'question', 'strategy', 'principle'],
  design_spiral: ['define', 'biologize', 'discover', 'abstract', 'emulate', 'evaluate'],
} as const

export type PromptToolKey = keyof typeof PROMPT_TOOLS

interface ToolPromptsProps {
  kind: PromptToolKey
  ageMode: 'young' | 'older'
  topic: string
}

export default function ToolPrompts({ kind, ageMode, topic }: ToolPromptsProps) {
  const t = useTranslations('thinking_tools')
  const fields = PROMPT_TOOLS[kind]
  const [answers, setAnswers] = useState<Record<string, string>>({})

  return (
    <div data-testid={`tool-${kind}`} className="rounded-card border border-ink/20 bg-tint-blue p-4">
      <p className="font-display text-lg text-challenge mb-1">{t(`${kind}_title`)}</p>
      <p className="font-body text-sm text-ink/60 mb-4">
        {t(ageMode === 'young' ? `${kind}_desc_young` : `${kind}_desc_older`, { topic })}
      </p>

      {fields.map((field) => (
        <div key={field} className="flex flex-col gap-1 mb-3">
          <label htmlFor={`${kind}-${field}`} className="font-body text-xs text-ink/60">
            {t(`${kind}_${field}`)}
          </label>
          <textarea
            autoComplete="off"
            id={`${kind}-${field}`}
            data-testid={`${kind}-${field}`}
            value={answers[field] ?? ''}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [field]: e.target.value }))}
            placeholder={t('your_ideas')}
            rows={2}
            className="w-full rounded-card border border-ink/20 px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-challenge bg-white resize-none"
          />
        </div>
      ))}
    </div>
  )
}
