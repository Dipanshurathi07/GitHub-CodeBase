import { useMemo, useState } from 'react'
import { FolderTree, FileText, MessagesSquare } from 'lucide-react'
import FileTree from './FileTree.jsx'
import FileExplainPanel from './FileExplainPanel.jsx'
import ChatPanel from './ChatPanel.jsx'
import { mockFileTree } from '../data/mockData.js'

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
  const [selected, setSelected] = useState(null) // { node, path }
  const [mobileTab, setMobileTab] = useState('tree') // tree | explain | chat

  const tree = useMemo(() => mockFileTree, [])

  function handleSelect(node, path) {
    setSelected({ node, path })
    setMobileTab('explain')
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
            <ChatPanel />
          </div>
        </div>
      </div>
    </div>
  )
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
