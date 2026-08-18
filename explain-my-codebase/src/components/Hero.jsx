import { useState } from 'react'
import { ArrowRight, FolderTree, FileText, MessagesSquare, Sparkles } from 'lucide-react'
import DiffTerminal from './DiffTerminal.jsx'

const EXAMPLES = ['tanstack/query', 'facebook/react', 'vercel/next.js']

export default function Hero({ onSubmit }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Paste a GitHub repo URL to continue.')
      return
    }
    setError('')
    onSubmit(trimmed)
  }

  return (
    <main className="max-w-[1400px] mx-auto px-5 sm:px-8 pt-16 sm:pt-24 pb-24">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-16 items-center">
        {/* Left: copy + form */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-signal-soft bg-signal-soft/20 text-signal text-xs font-mono mb-6">
            <Sparkles size={12} />
            AI GitHub onboarding
          </div>

          <h1 className="font-mono text-4xl sm:text-[3.4rem] leading-[1.08] font-semibold tracking-tight text-text-primary">
            Read the diff,
            <br />
            not the <span className="text-add">whole repo.</span>
          </h1>

          <p className="mt-6 text-lg text-text-muted max-w-lg leading-relaxed">
            Paste any public GitHub URL. Get a plain-English map of the file
            structure, a summary for every file that matters, and a chat that
            already knows the codebase — before you've cloned anything.
          </p>

          <form onSubmit={handleSubmit} className="mt-9 max-w-lg">
            <label htmlFor="repo-url" className="block text-sm text-text-muted mb-2 font-medium">
              Repository URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-faint font-mono text-sm select-none">
                  github.com/
                </span>
                <input
                  id="repo-url"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="tanstack/query"
                  className="w-full bg-ink-panel border border-ink-border rounded-md pl-[6.6rem] pr-3.5 py-3 text-sm font-mono text-text-primary placeholder:text-text-faint focus:border-signal/60 focus:outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 bg-add text-ink font-semibold text-sm px-5 py-3 rounded-md hover:bg-add/90 active:scale-[0.98] transition-all whitespace-nowrap"
              >
                Explain this repo
                <ArrowRight size={16} />
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-del">{error}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-text-faint">
              <span>Try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setUrl(ex)}
                  className="font-mono px-2 py-1 rounded border border-ink-border hover:border-signal/50 hover:text-signal transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </form>
        </div>

        {/* Right: signature diff terminal */}
        <div className="flex justify-center lg:justify-end">
          <DiffTerminal />
        </div>
      </div>

      {/* Feature strip */}
      <div className="mt-28 grid sm:grid-cols-3 gap-px bg-ink-border rounded-lg overflow-hidden border border-ink-border">
        <Feature
          icon={FolderTree}
          title="File structure, mapped"
          desc="A navigable tree of the repo with weight and purpose at a glance — no more guessing what's core vs. config."
        />
        <Feature
          icon={FileText}
          title="Any file, explained"
          desc="Select a file to get a plain-English summary, its key responsibilities, and what depends on it."
        />
        <Feature
          icon={MessagesSquare}
          title="Chat with the codebase"
          desc='Ask "where does auth happen" or "how does retry work" and get answers grounded in the actual code.'
        />
      </div>
    </main>
  )
}

function Feature({ icon: Icon, title, desc }) {
  return (
    <div className="bg-ink p-7 sm:p-8">
      <Icon size={18} className="text-add mb-4" strokeWidth={1.75} />
      <h3 className="font-mono text-[15px] font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
    </div>
  )
}
