import { useEffect, useState } from 'react'

// The signature element: a codebase's confusion resolving into
// understanding, staged as a git diff. Lines of raw code appear first,
// then plain-English explanation lines are "added" beneath them —
// literally the product's core action, rendered as the medium GitHub
// developers already read every day.

const SEQUENCE = [
  { type: 'ctx', text: '  src/core/query.ts' },
  { type: 'code', text: '  class Query<TData> {' },
  { type: 'code', text: '    #dedupe: Promise<TData> | null = null' },
  { type: 'add', text: '+ // Tracks ONE query\'s lifecycle: fresh → stale → gc\'d' },
  { type: 'add', text: '+ // #dedupe stops 10 components triggering 10 fetches' },
  { type: 'code', text: '    fetch() {' },
  { type: 'code', text: '      if (this.#dedupe) return this.#dedupe' },
  { type: 'add', text: '+ // Re-uses an in-flight request instead of starting a new one' },
  { type: 'code', text: '    }' },
  { type: 'code', text: '  }' },
]

export default function DiffTerminal() {
  const [visibleLines, setVisibleLines] = useState(0)
  const [cycle, setCycle] = useState(0)

  useEffect(() => {
    if (visibleLines >= SEQUENCE.length) {
      const pause = setTimeout(() => {
        setVisibleLines(0)
        setCycle((c) => c + 1)
      }, 2600)
      return () => clearTimeout(pause)
    }
    const delay = SEQUENCE[visibleLines].type === 'add' ? 420 : 260
    const t = setTimeout(() => setVisibleLines((v) => v + 1), delay)
    return () => clearTimeout(t)
  }, [visibleLines, cycle])

  return (
    <div className="w-full max-w-xl rounded-lg border border-ink-border bg-ink-panel shadow-glow overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 sm:px-4 py-3 border-b border-ink-border bg-ink-panelAlt">
        <span className="w-2.5 h-2.5 rounded-full bg-[#4B4F5E]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#4B4F5E]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#4B4F5E]" />
        <span className="ml-3 truncate text-xs font-mono text-text-faint">query.ts — explained</span>
      </div>
      <div className="p-3 sm:p-4 font-mono text-[11px] sm:text-[13px] leading-[1.85] min-h-[230px] sm:min-h-[280px] overflow-x-auto">
        {SEQUENCE.slice(0, visibleLines).map((line, i) => (
          <div
            key={`${cycle}-${i}`}
            className={
              'whitespace-pre animate-fadeUp ' +
              (line.type === 'add'
                ? 'text-add bg-add-bg/60 -mx-4 px-4'
                : line.type === 'ctx'
                ? 'text-text-faint'
                : 'text-text-muted')
            }
          >
            {line.text}
          </div>
        ))}
        {visibleLines < SEQUENCE.length && (
          <span className="inline-block w-2 h-4 bg-signal align-middle animate-blink ml-1" />
        )}
      </div>
    </div>
  )
}
