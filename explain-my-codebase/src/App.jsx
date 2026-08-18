import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import Workspace from './components/Workspace.jsx'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'

function parseRepoName(input) {
  const trimmed = input.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\/+$/, '')
  return trimmed || input
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/workspace/:owner/:repo" element={<WorkspacePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const isWorkspace = location.pathname.startsWith('/workspace/')
  const repoName = isWorkspace ? decodeURIComponent(location.pathname.split('/').slice(2).join('/')) : ''

  return (
    <div className="min-h-screen bg-ink text-text-primary">
      <Header
        view={isWorkspace ? 'workspace' : 'landing'}
        repoName={repoName}
        onReset={() => navigate('/')}
      />
      <Outlet />
    </div>
  )
}

function Home() {
  const navigate = useNavigate()

  function handleRepoSubmit(url) {
    const repoName = parseRepoName(url)
    const [owner, repo] = repoName.split('/')

    if (owner && repo) {
      navigate(`/workspace/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`)
    }
  }

  return (
    <Hero onSubmit={handleRepoSubmit} />
  )
}

function WorkspacePage() {
  const { owner, repo } = useParams()
  return <Workspace repoName={`${owner}/${repo}`} />
}
