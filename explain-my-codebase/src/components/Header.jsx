import { useState } from 'react'
import { GitBranch, ArrowLeft, Github } from 'lucide-react'

export default function Header({ view, repoName, onReset }) {
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const [popupBlocked, setPopupBlocked] = useState(false)

  function handleGitHubSignIn() {
    const popup = window.open(
      'http://localhost:3000/auth/github',
      'github-signin',
      'width=500,height=700,scrollbars=yes,resizable=yes'
    )

    if (!popup) {
      setPopupBlocked(true)
      window.location.href = 'http://localhost:3000/auth/github'
      return
    }

    setPopupBlocked(false)
    setIsSignInOpen(false)
  }

  return (
    <>
      <header className="border-b border-ink-border bg-ink/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <button
            onClick={onReset}
            className="flex items-center gap-2.5 group"
            aria-label="Explain My Codebase, go to start"
          >
            <span className="w-7 h-7 rounded-md bg-add-bg border border-add/30 flex items-center justify-center font-mono text-add text-sm font-bold group-hover:border-add/60 transition-colors">
              +
            </span>
            <span className="font-mono text-[15px] font-semibold tracking-tight text-text-primary">
              explain<span className="text-text-faint">/</span>my-codebase
            </span>
          </button>

          <div className="flex items-center gap-3">
            {view === 'workspace' && (
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2 text-sm text-text-muted font-mono">
                  <GitBranch size={14} className="text-signal" />
                  <span className="text-text-primary">{repoName}</span>
                </div>
                <button
                  onClick={onReset}
                  className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors px-3 py-1.5 rounded-md border border-ink-border hover:border-ink-border/80 hover:bg-ink-panel"
                >
                  <ArrowLeft size={14} />
                  New repo
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setPopupBlocked(false)
                setIsSignInOpen(true)
              }}
              className="flex items-center gap-2 rounded-md border border-ink-border bg-ink-panel px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-add/50 hover:text-add"
            >
              <Github size={16} />
              Sign in
            </button>
          </div>
        </div>
      </header>

      {isSignInOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-ink-border bg-ink-panel p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Continue to your workspace</h2>
                <p className="mt-1 text-sm text-text-muted">Sign in with GitHub to access your saved repositories.</p>
              </div>
              <button
                onClick={() => setIsSignInOpen(false)}
                className="text-sm text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={handleGitHubSignIn}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-add/30 bg-add-bg px-4 py-3 text-sm font-semibold text-add transition-colors hover:border-add/50"
              >
                <Github size={16} />
                Continue with GitHub
              </button>

              {popupBlocked && (
                <p className="text-sm text-amber-400">
                  Pop-up was blocked. Please allow pop-ups for this site and try again.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
