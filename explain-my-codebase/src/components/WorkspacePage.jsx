import { useParams } from 'react-router-dom'
import Workspace from './Workspace.jsx'

export default function WorkspacePage() {
  const { owner, repo } = useParams()
  return <Workspace repoName={`${owner}/${repo}`} />
}
