import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { FolderTree, FileText, MessagesSquare } from 'lucide-react'
import FileTree from './FileTree.jsx'
import FileExplainPanel from './FileExplainPanel.jsx'
import ChatPanel from './ChatPanel.jsx'
import { fetchFile, fetchFileSummary, ingestRepository } from '../Slice/ReduxSlice/githubSlice.js'

function findNodeByName(node, name, path = '') {
  const currentPath = path ? `${path}/${node.name}` : node.name
  if (node.name === name && node.type === 'file') return { node, path: currentPath }
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeByName(child, name, currentPath)
      if (found) return found
    }
  }
  return null
}

export default function Workspace({ repoName }) {
  const dispatch = useDispatch()
  const { tree: githubTree, filesByPath, summariesByPath, summaryLoadingPath, ingestStatus, indexedCount, error } = useSelector((state) => state.github)
  const { user } = useSelector((state) => state.auth)
  const [selected, setSelected] = useState(null) // { node, path }
  const [mobileTab, setMobileTab] = useState('tree') // tree | explain | chat

  const [owner, repo] = repoName.split('/')

  useEffect(() => {
    if (!owner || !repo) return
    dispatch(ingestRepository({ owner, repo }))
  }, [dispatch, owner, repo])

  const tree = useMemo(() => buildFileTree(githubTree), [githubTree])

  function handleSelect(node, path) {
    setSelected({ node, path })
    setMobileTab('explain')
    dispatch(fetchFile({ owner, repo, path }))
      .unwrap()
      .then(() => dispatch(fetchFileSummary({ owner, repo, path })))
  }

  function handleJumpTo(fileName) {
    const found = findNodeByName(tree, fileName)
    if (found) {
      setSelected(found)
      setMobileTab('explain')
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-6">
      {/* Mobile tab switcher */}
      <div className="flex lg:hidden mb-4 rounded-md border border-ink-border overflow-hidden">
        <MobileTab icon={FolderTree} label="Files" active={mobileTab === 'tree'} onClick={() => setMobileTab('tree')} />
        <MobileTab icon={FileText} label="Explain" active={mobileTab === 'explain'} onClick={() => setMobileTab('explain')} />
        <MobileTab icon={MessagesSquare} label="Chat" active={mobileTab === 'chat'} onClick={() => setMobileTab('chat')} />
      </div>

      <div className="grid lg:grid-cols-[260px_1fr_360px] gap-4 h-[calc(100vh-9.5rem)] lg:h-[calc(100vh-8rem)]">
        {/* File tree */}
        <div
          className={`${mobileTab === 'tree' ? 'block' : 'hidden'} lg:block rounded-lg border border-ink-border bg-ink-panel overflow-y-auto scrollbar-thin`}
        >
          <div className="px-4 py-3 border-b border-ink-border sticky top-0 bg-ink-panel z-10">
            <p className="text-xs font-semibold text-text-faint uppercase tracking-wide">
              {repoName}
            </p>
            <p className="mt-1 text-[11px] text-text-faint">
              {ingestStatus === 'loading'
                  ? 'Indexing repository...'
                  : ingestStatus === 'succeeded'
                    ? `${indexedCount} files indexed`
                    : error || (user ? 'Ready' : 'Public repository mode')}
            </p>
          </div>
          <FileTree tree={tree} selectedPath={selected?.path} onSelect={handleSelect} />
        </div>

        {/* Explain panel */}
        <div
          className={`${mobileTab === 'explain' ? 'block' : 'hidden'} lg:block rounded-lg border border-ink-border bg-ink-panel overflow-hidden`}
        >
          <FileExplainPanel
            selectedNode={selected?.node}
            selectedPath={selected?.path}
            file={selected ? filesByPath[selected.path] : null}
            summary={selected ? summariesByPath[selected.path] : null}
            isSummaryLoading={selected?.path === summaryLoadingPath}
            onJumpTo={handleJumpTo}
          />
        </div>

        {/* Chat panel */}
        <div
          className={`${mobileTab === 'chat' ? 'block' : 'hidden'} lg:block rounded-lg border border-ink-border bg-ink-panel overflow-hidden`}
        >
          <div className="px-4 py-3 border-b border-ink-border flex items-center gap-2">
            <MessagesSquare size={14} className="text-signal" />
            <p className="text-xs font-semibold text-text-faint uppercase tracking-wide">
              Chat with codebase
            </p>
          </div>
          <div className="h-[calc(100%-2.75rem)]">
            <ChatPanel owner={owner} repo={repo} />
          </div>
        </div>
      </div>
    </div>
  )
}

function buildFileTree(items) {
  const root = { name: '', type: 'folder', children: [] }
  for (const item of items || []) {
    const parts = item.path.split('/')
    let children = root.children
    parts.forEach((name, index) => {
      let node = children.find((child) => child.name === name)
      if (!node) {
        node = { name, type: index === parts.length - 1 && item.type === 'blob' ? 'file' : 'folder', children: [] }
        if (node.type === 'file') {
          node.lang = name.split('.').pop()
          node.lines = item.size ? Math.max(1, Math.round(item.size / 35)) : 0
          delete node.children
        }
        children.push(node)
      }
      children = node.children || []
    })
  }
  return root
}

function MobileTab({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
        active ? 'bg-ink-panel text-text-primary' : 'bg-ink text-text-faint'
      }`}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}
