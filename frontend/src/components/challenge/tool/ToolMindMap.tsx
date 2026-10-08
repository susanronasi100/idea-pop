'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { btnSecondary } from '@/components/challenge/buttons';

interface ToolMindMapProps {
  ageMode: 'young' | 'older'
  topic: string
}

const MAX_BRANCHES = 6

export default function ToolMindMap({ ageMode, topic }: ToolMindMapProps) {
  const t = useTranslations('thinking_tools')
  const [branches, setBranches] = useState<string[]>(['', ''])

  const handleBranchChange = (i: number, value: string) => {
    setBranches((prev) => {
      const next = [...prev]
      next[i] = value
      return next
    })
  }

  const addBranch = () => {
    if (branches.length < MAX_BRANCHES) {
      setBranches((prev) => [...prev, ''])
    }
  }

  return (
    <div data-testid="tool-mind-map" className="rounded-card border border-ink/20 bg-tint-blue p-4">
      <p className="font-display text-lg text-challenge mb-1">{t('mind_map_title')}</p>
      <p className="font-body text-sm text-ink/60 mb-4">
        {ageMode === 'young' ? t('mind_map_desc_young') : t('mind_map_desc_older')}
      </p>

      {/* Center node */}
      <div className="flex items-center justify-center mb-6">
        <div className="rounded-card border-2 border-challenge bg-challenge/10 px-4 py-2 font-body font-bold text-challenge text-sm text-center max-w-xs">
          {topic}
        </div>
      </div>

      {/* Branch inputs */}
      <div className="flex flex-col gap-3">
        {branches.map((branch, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="font-body text-xs text-ink/40 w-5 shrink-0 text-right">{i + 1}.</span>
            <div className="w-3 h-px bg-ink/30 shrink-0" />
            <input
              autoComplete="off"
              data-testid={`branch-${i}`}
              type="text"
              value={branch}
              onChange={(e) => handleBranchChange(i, e.target.value)}
              placeholder={t('mind_map_branch', { n: i + 1 })}
              className="w-full rounded-card border border-ink/20 px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-challenge bg-white"
            />
          </div>
        ))}
      </div>

      {branches.length < MAX_BRANCHES && (
        <button
          data-testid="add-branch"
          onClick={addBranch}
          className={`${btnSecondary} mt-4`}
        >
          {t('mind_map_add')}
        </button>
      )}
    </div>
  )
}
