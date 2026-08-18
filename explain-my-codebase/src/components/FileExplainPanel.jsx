import { FileCode2, Circle, ArrowUpRight, MousePointerClick } from 'lucide-react'
import { mockExplanations } from '../data/mockData.js'

const RISK_LABEL = {
  high: { text: 'Core / high blast-radius', color: 'text-del', dot: 'bg-del' },
  medium: { text: 'Moderately connected', color: 'text-signal', dot: 'bg-signal' },
  low: { text: 'Isolated / low risk', color: 'text-add', dot: 'bg-add' },
}

export default function FileExplainPanel({ selectedNode, selectedPath, onJumpTo }) {
  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8 text-text-faint">
        <MousePointerClick size={22} className="mb-3" />
        <p className="text-sm max-w-[220px]">
          Select a file from the tree to see what it does and why it matters.
        </p>
      </div>
    )
  }

  const explanation = mockExplanations[selectedNode.name] || {
    summary: "No explanation generated yet for this file — in a live build, this is where the AI summary would stream in.",
    keyPoints: [],
    dependents: [],
    risk: 'low',
  }
  const risk = RISK_LABEL[explanation.risk]

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-4 border-b border-ink-border">
        <div className="flex items-center gap-2 text-text-primary">
          <FileCode2 size={16} className="text-signal shrink-0" />
          <h2 className="font-mono text-[13.5px] font-medium truncate">{selectedPath}</h2>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-text-faint font-mono">
          <span>{selectedNode.lines} lines</span>
          <span className="w-1 h-1 rounded-full bg-ink-border" />
          <span className={`flex items-center gap-1.5 ${risk.color}`}>
            <Circle size={6} className={`${risk.dot} fill-current`} />
            {risk.text}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-5">
        <section>
          <h3 className="text-xs font-semibold text-text-faint uppercase tracking-wide mb-2.5">
            What this file does
          </h3>
          <p className="text-[14.5px] text-text-primary leading-relaxed">{explanation.summary}</p>
        </section>

        {explanation.keyPoints.length > 0 && (
          <section className="mt-7">
            <h3 className="text-xs font-semibold text-text-faint uppercase tracking-wide mb-2.5">
              Key points
            </h3>
            <ul className="space-y-2.5">
              {explanation.keyPoints.map((point, i) => (
                <li key={i} className="flex gap-2.5 text-[14px] text-text-muted leading-relaxed">
                  <span className="text-add font-mono mt-[2px] shrink-0">+</span>
                  {point}
                </li>
              ))}
            </ul>
          </section>
        )}

        {explanation.dependents.length > 0 && (
          <section className="mt-7">
            <h3 className="text-xs font-semibold text-text-faint uppercase tracking-wide mb-2.5">
              Used by
            </h3>
            <div className="flex flex-wrap gap-2">
              {explanation.dependents.map((dep) => (
                <button
                  key={dep}
                  onClick={() => onJumpTo?.(dep)}
                  className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-md border border-ink-border text-text-muted hover:text-signal hover:border-signal/40 transition-colors"
                >
                  {dep}
                  <ArrowUpRight size={11} />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
