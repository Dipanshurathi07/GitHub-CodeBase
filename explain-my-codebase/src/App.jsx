import { useState } from 'react'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import Workspace from './components/Workspace.jsx'

function parseRepoName(input) {
  const trimmed = input.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\/+$/, '')
  return trimmed || input
}

export default function App() {
  const [view, setView] = useState('landing') // 'landing' | 'workspace'
  const [repoName, setRepoName] = useState('')

  function handleRepoSubmit(url) {
    setRepoName(parseRepoName(url))
    setView('workspace')
  }

  function handleReset() {
    setView('landing')
    setRepoName('')
  }

  return (
    <div className="min-h-screen bg-ink text-text-primary">
      <Header view={view} repoName={repoName} onReset={handleReset} />
      {view === 'landing' ? (
        <Hero onSubmit={handleRepoSubmit} />
      ) : (
        <Workspace repoName={repoName} />
      )}
    </div>
  )
}
