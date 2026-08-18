import { useState } from 'react'
import { ChevronRight, Folder, FolderOpen, FileCode2 } from 'lucide-react'

function langColor(lang) {
  switch (lang) {
    case 'ts':
    case 'tsx':
      return 'text-signal'
    case 'json':
      return 'text-del'
    case 'md':
      return 'text-text-muted'
    default:
      return 'text-text-muted'
  }
}

function TreeNode({ node, depth, path, selectedPath, onSelect, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const currentPath = path ? `${path}/${node.name}` : node.name

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-1.5 px-2 py-[5px] rounded hover:bg-ink-panelAlt text-sm text-text-muted transition-colors"
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <ChevronRight
            size={13}
            className={`text-text-faint shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          />
          {open ? (
            <FolderOpen size={14} className="text-signal shrink-0" />
          ) : (
            <Folder size={14} className="text-text-faint shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.name}
                node={child}
                depth={depth + 1}
                path={currentPath}
                selectedPath={selectedPath}
                onSelect={onSelect}
                defaultOpen={defaultOpen}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const isSelected = selectedPath === currentPath

  return (
    <button
      onClick={() => onSelect(node, currentPath)}
      className={`w-full flex items-center gap-1.5 px-2 py-[5px] rounded text-sm transition-colors group ${
        isSelected
          ? 'bg-signal-soft/40 text-text-primary'
          : 'text-text-muted hover:bg-ink-panelAlt hover:text-text-primary'
      }`}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
    >
      <FileCode2 size={14} className={`shrink-0 ${isSelected ? 'text-signal' : langColor(node.lang)}`} />
      <span className="truncate">{node.name}</span>
      {isSelected && <span className="ml-auto w-1 h-1 rounded-full bg-add shrink-0" />}
    </button>
  )
}

export default function FileTree({ tree, selectedPath, onSelect }) {
  return (
    <div className="py-2 px-1">
      {tree.children.map((child) => (
        <TreeNode
          key={child.name}
          node={child}
          depth={0}
          path=""
          selectedPath={selectedPath}
          onSelect={onSelect}
          defaultOpen={true}
        />
      ))}
    </div>
  )
}
