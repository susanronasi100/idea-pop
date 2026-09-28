'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import ToolFiveWhys from './ToolFiveWhys'
import ToolScamper from './ToolScamper'
import ToolMindMap from './ToolMindMap'

export type ToolKey = 'five_whys' | 'scamper' | 'mind_map'

export const SUPPORTED_TOOLS: readonly string[] = ['five_whys', 'scamper', 'mind_map']

export function isToolKey(kind: string): kind is ToolKey {
  return SUPPORTED_TOOLS.includes(kind)
}

interface ToolSelectorProps {
  tools: ToolKey[]
  topic: string
  ageMode: 'young' | 'older'
}

const TOOL_LABEL_KEYS = {
  five_whys: 'tab_five_whys',
  scamper: 'tab_scamper',
  mind_map: 'tab_mind_map',
} as const satisfies Record<ToolKey, string>

export default function ToolSelector({ tools, topic, ageMode }: ToolSelectorProps) {
  const t = useTranslations('thinking_tools')
  const [open, setOpen] = useState(false)
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null)

  if (!tools || tools.length === 0) return null

  const accordionTitle =
    ageMode === 'young' ? t('accordion_young') : t('accordion_older')

  return (
    <div data-testid="tool-selector" className="rounded-card border border-ink/20 overflow-hidden">
      {/* Accordion toggle */}
      <button
        data-testid="tool-accordion-toggle"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-tint-lavender font-display text-sm text-ink hover:bg-tint-lavender/80 transition-colors"
        aria-expanded={open}
      >
        <span>{accordionTitle}</span>
        <span
          className="text-ink/50 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {/* Accordion body */}
      {open && (
        <div className="bg-white px-4 py-4">
          {/* Tool tabs / pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {tools.map((tool) => (
              <button
                key={tool}
                data-testid={`tool-tab-${tool}`}
                onClick={() => setActiveTool((prev) => (prev === tool ? null : tool))}
                className={`font-body text-sm rounded-card px-3 py-1.5 border transition-colors ${
                  activeTool === tool
                    ? 'bg-challenge text-white border-challenge'
                    : 'border-ink/20 text-ink hover:bg-challenge/10 hover:border-challenge/40'
                }`}
              >
                {t(TOOL_LABEL_KEYS[tool])}
              </button>
            ))}
          </div>

          {/* Active tool component */}
          {activeTool === 'five_whys' && (
            <ToolFiveWhys ageMode={ageMode} topic={topic} />
          )}
          {activeTool === 'scamper' && (
            <ToolScamper ageMode={ageMode} topic={topic} />
          )}
          {activeTool === 'mind_map' && (
            <ToolMindMap ageMode={ageMode} topic={topic} />
          )}
        </div>
      )}
    </div>
  )
}
