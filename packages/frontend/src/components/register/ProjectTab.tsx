import { useState } from 'react'
import type { Project } from '../../types'

interface ProjectTabProps {
  projects: Project[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAddProject?: () => void
}

export function ProjectTab({ projects, selectedId, onSelect, onAddProject }: ProjectTabProps) {
  const [search, setSearch] = useState('')

  const total = projects.reduce((a, p) => a + (p._count?.drawings ?? 0), 0)

  const filtered = search
    ? projects.filter(p =>
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        p.name.toLowerCase().includes(search.toLowerCase())
      )
    : projects

  return (
    <div className="mb-4">
      {/* Search bar + Add button */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3 text-[11px] pointer-events-none">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects by name or code…"
            className="w-full pl-7 pr-7 py-1.5 text-xs bg-surface border border-border rounded-md text-text placeholder-text-3 focus:outline-none focus:border-info-border transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-3 hover:text-text text-[10px]"
              title="Clear search"
            >✕</button>
          )}
        </div>
        {onAddProject && (
          <button
            onClick={onAddProject}
            className="shrink-0 text-xs px-3 py-1.5 bg-info-bg text-info-text border border-info-border rounded-md hover:opacity-80 transition-opacity whitespace-nowrap"
          >
            + Add project
          </button>
        )}
      </div>

      {/* Project list */}
      <div className="border border-border rounded-md overflow-hidden bg-surface" style={{ maxHeight: 212 }}>
        {/* Scrollable inner — "All projects" pinned at top */}
        <button
          onClick={() => onSelect(null)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs border-b border-border transition-colors ${
            selectedId === null
              ? 'bg-info-bg text-info-text font-medium'
              : 'text-text-2 hover:bg-surface-2'
          }`}
        >
          <span className="text-sm leading-none">🌐</span>
          <span className="flex-1 text-left font-medium">All projects</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            selectedId === null ? 'bg-surface text-info-text' : 'bg-surface-2 text-text-2'
          }`}>{total}</span>
        </button>

        <div className="overflow-y-auto" style={{ maxHeight: 170 }}>
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-text-3 text-center italic">
              No projects match "{search}"
            </div>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs border-b border-border last:border-0 transition-colors ${
                  selectedId === p.id
                    ? 'bg-info-bg text-info-text font-medium'
                    : 'text-text-2 hover:bg-surface-2'
                }`}
              >
                <div className={`w-6 h-6 rounded flex items-center justify-center text-[11px] shrink-0 ${
                  selectedId === p.id ? 'bg-surface' : 'bg-surface-2'
                }`}>
                  {p.iconEmoji}
                </div>
                <span className={`text-[11px] font-mono font-semibold shrink-0 ${
                  selectedId === p.id ? 'text-info-text' : 'text-text-3'
                }`}>{p.code}</span>
                <span className="flex-1 text-left truncate">{p.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                  selectedId === p.id ? 'bg-surface text-info-text' : 'bg-surface-2 text-text-2'
                }`}>{p._count?.drawings ?? 0}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
