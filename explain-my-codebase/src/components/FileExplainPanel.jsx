import { FileCode2, Circle, ArrowUpRight, MousePointerClick } from 'lucide-react'

const RISK_LABEL = {
  high: { text: 'Core / high blast-radius', color: 'text-del', dot: 'bg-del' },
  medium: { text: 'Moderately connected', color: 'text-signal', dot: 'bg-signal' },
  low: { text: 'Isolated / low risk', color: 'text-add', dot: 'bg-add' },
}

export default function FileExplainPanel({ selectedNode, selectedPath, file, summary, isSummaryLoading, onJumpTo }) {
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

  const fallbackSummary = file?.content
    ? 'The file was loaded, but its explanation could not be generated yet.'
    : 'No explanation generated yet for this file. Select a file and let the backend summarize it.'

  const risk = RISK_LABEL.low
  const keyPoints = []
  const dependents = []

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-4 border-b border-ink-border">
        <div className="flex items-center gap-2 text-text-primary">
          <FileCode2 size={16} className="text-signal shrink-0" />
          <h2 className="font-mono text-[13.5px] font-medium truncate">{selectedPath}</h2>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-text-faint font-mono">
          <span>{file?.content ? file.content.split('\n').length : selectedNode.lines || 0} lines</span>
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
          <p className="max-w-full break-words text-[14.5px] text-text-primary leading-relaxed whitespace-pre-line">
            {isSummaryLoading ? 'Reading this file from the vector database...' : summary || fallbackSummary}
          </p>
        </section>

        {file?.content && (
          <section className="mt-8">
            <h3 className="text-xs font-semibold text-text-faint uppercase tracking-wide mb-2.5">
              Source code
            </h3>
            <pre className="w-full max-w-full max-h-[520px] overflow-x-auto overflow-y-auto rounded-md border border-ink-border bg-ink px-4 py-3 text-[12px] leading-relaxed text-text-muted whitespace-pre scrollbar-thin">
              <code>{file.content}</code>
            </pre>
          </section>
        )}

        {keyPoints.length > 0 && (
          <section className="mt-7">
            <h3 className="text-xs font-semibold text-text-faint uppercase tracking-wide mb-2.5">
              Key points
            </h3>
            <ul className="space-y-2.5">
              {keyPoints.map((point, i) => (
                <li key={i} className="flex gap-2.5 text-[14px] text-text-muted leading-relaxed">
                  <span className="text-add font-mono mt-[2px] shrink-0">+</span>
                  {point}
                </li>
              ))}
            </ul>
          </section>
        )}

        {dependents.length > 0 && (
          <section className="mt-7">
            <h3 className="text-xs font-semibold text-text-faint uppercase tracking-wide mb-2.5">
              Used by
            </h3>
            <div className="flex flex-wrap gap-2">
              {dependents.map((dep) => (
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
