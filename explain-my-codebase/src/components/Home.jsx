import { useNavigate } from 'react-router-dom'
import Hero from './Hero.jsx'

function parseRepoName(input) {
  const trimmed = input.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\/+$/, '')
  return trimmed || input
}

export default function Home() {
  const navigate = useNavigate()

  function handleRepoSubmit(url) {
    const repoName = parseRepoName(url)
    const [owner, repo] = repoName.split('/')

    if (owner && repo) {
      navigate(`/workspace/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`)
    }
  }

  return <Hero onSubmit={handleRepoSubmit} />
}
