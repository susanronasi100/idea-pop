'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface ToolScamperProps {
  ageMode: 'young' | 'older'
  topic: string
}

type ScamperKey = 's' | 'c' | 'a' | 'm' | 'p' | 'e' | 'r'

interface ScamperItem {
  key: ScamperKey
  emoji: string
}

// Label and prompts live in messages: thinking_tools.scamper_<key>_{label,young,older}.
const SCAMPER_ITEMS: ScamperItem[] = [
  { key: 's', emoji: '🔄' },
  { key: 'c', emoji: '🔗' },
  { key: 'a', emoji: '🔧' },
  { key: 'm', emoji: '📏' },
  { key: 'p', emoji: '♻️' },
  { key: 'e', emoji: '✂️' },
  { key: 'r', emoji: '🔃' },
]

export default function ToolScamper({ ageMode, topic }: ToolScamperProps) {
  const t = useTranslations('thinking_tools')
  const [answers, setAnswers] = useState<Record<ScamperKey, string>>({
    s: '',
    c: '',
    a: '',
    m: '',
    p: '',
    e: '',
    r: '',
  })

  const handleChange = (key: ScamperKey, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div data-testid="tool-scamper" className="rounded-card border border-ink/20 bg-tint-lavender p-4">
      <p className="font-display text-lg text-challenge mb-1">{t('scamper_title')}</p>
      <p className="font-body text-sm text-ink/60 mb-4">
        {ageMode === 'young'
          ? t('scamper_desc_young', { topic })
          : t('scamper_desc_older', { topic })}
      </p>

      <div className="flex flex-col gap-4">
        {SCAMPER_ITEMS.map((item) => (
          <div
            key={item.key}
            data-testid={`scamper-${item.key}`}
            className="flex flex-col gap-1"
          >
            <label className="font-body text-xs font-semibold text-ink/70 flex items-center gap-1">
              <span>{item.emoji}</span>
              <span className="text-challenge uppercase tracking-wide">{item.key.toUpperCase()}</span>
              <span className="text-ink/50">— {t(`scamper_${item.key}_label`)}</span>
            </label>
            <p className="font-body text-xs text-ink/50 mb-1">
              {ageMode === 'young'
                ? t(`scamper_${item.key}_young`)
                : t(`scamper_${item.key}_older`)}
            </p>
            <textarea
              autoComplete="off"
              value={answers[item.key]}
              onChange={(e) => handleChange(item.key, e.target.value)}
              placeholder={t('your_ideas')}
              rows={2}
              className="w-full rounded-card border border-ink/20 px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-challenge bg-white resize-none"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
