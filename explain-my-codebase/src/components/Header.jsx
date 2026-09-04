import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { GitBranch, ArrowLeft, Github, LogOut, ChevronDown } from 'lucide-react'
import { clearUser, fetchCurrentUser } from '../Slice/ReduxSlice/authSlice.js'
import { apiUrl } from '../lib/api.js'

export default function Header({ view, repoName, onReset }) {
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const [popupBlocked, setPopupBlocked] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  useEffect(() => {
    dispatch(fetchCurrentUser())
  }, [dispatch])

  async function refreshUser() {
    const result = await dispatch(fetchCurrentUser())
    return fetchCurrentUser.fulfilled.match(result)
  }

  function handleGitHubSignIn() {
    const popup = window.open(
      apiUrl('/auth/github'),
      'github-signin',
      'width=500,height=700,scrollbars=yes,resizable=yes'
    )

    if (!popup) {
      setPopupBlocked(true)
      window.location.href = apiUrl('/auth/github')
      return
    }

    setPopupBlocked(false)
    setIsSignInOpen(false)

    const poll = window.setInterval(async () => {
      if (await refreshUser()) window.clearInterval(poll)
    }, 1000)

    window.setTimeout(() => window.clearInterval(poll), 120000)
  }

  async function handleLogout() {
    await fetch(apiUrl('/auth/logout'), { credentials: 'include' })
    dispatch(clearUser())
    setIsProfileOpen(false)
  }

  return (
    <>
      <header className="border-b border-ink-border bg-ink/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-3">
          <button
            onClick={onReset}
            className="flex items-center gap-2.5 group"
            aria-label="Explain My Codebase, go to start"
          >
            <span className="w-7 h-7 rounded-md bg-add-bg border border-add/30 flex items-center justify-center font-mono text-add text-sm font-bold group-hover:border-add/60 transition-colors">
              +
            </span>
            <span className="truncate font-mono text-[13px] sm:text-[15px] font-semibold tracking-tight text-text-primary">
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
                  className="flex items-center gap-1.5 text-xs sm:text-sm text-text-muted hover:text-text-primary transition-colors px-2 sm:px-3 py-1.5 rounded-md border border-ink-border hover:border-ink-border/80 hover:bg-ink-panel whitespace-nowrap"
                >
                  <ArrowLeft size={14} />
                  New repo
                </button>
              </div>
            )}

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-md border border-ink-border bg-ink-panel px-2.5 py-1.5 text-sm text-text-primary transition-colors hover:border-add/50"
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="h-7 w-7 rounded-full" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-signal-soft text-xs font-semibold text-signal">
                      {(user.displayName || user.username || 'G')[0].toUpperCase()}
                    </span>
                  )}
                  <span className="hidden sm:block max-w-32 truncate font-medium">
                    {user.displayName || user.username}
                  </span>
                  <ChevronDown size={14} className="text-text-muted" />
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-md border border-ink-border bg-ink-panel p-2 shadow-xl">
                    <div className="border-b border-ink-border px-3 py-2">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {user.displayName || user.username}
                      </p>
                      {user.username && <p className="truncate text-xs text-text-muted">@{user.username}</p>}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="mt-1 flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-text-muted hover:bg-ink-panelAlt hover:text-del"
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
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
            )}
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
