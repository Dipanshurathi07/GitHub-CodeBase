import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Header from './Header.jsx'

export default function Layout() {
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
