import type { Project } from '../../types'

interface ProjectTabProps {
  projects: Project[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function ProjectTab({ projects, selectedId, onSelect }: ProjectTabProps) {
  const total = projects.reduce((a, p) => a + (p._count?.drawings ?? 0), 0)

  return (
    <div className="flex gap-0.5 border-b border-border-strong mb-4 overflow-x-auto items-end">
      <button
        onClick={() => onSelect(null)}
        className={`text-xs px-4 py-2.5 border-b-[3px] mb-[-1px] flex items-center gap-2 whitespace-nowrap rounded-t-md border-r border-border mr-1 pr-4 transition-colors ${
          selectedId === null
            ? 'text-info-text border-b-info-border bg-info-bg font-medium'
            : 'text-text-2 border-b-transparent hover:text-text'
        }`}
      >
        <span>🌐</span>
        <span>All projects</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedId === null ? 'bg-surface text-info-text' : 'bg-surface-2 text-text-2'}`}>
          {total}
        </span>
      </button>

      {projects.map(p => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`text-xs px-4 py-2.5 border-b-[3px] mb-[-1px] flex items-center gap-2 whitespace-nowrap rounded-t-md transition-colors ${
            selectedId === p.id
              ? 'text-info-text border-b-info-border bg-info-bg font-medium'
              : 'text-text-2 border-b-transparent hover:text-text'
          }`}
        >
          <div className="w-[22px] h-[22px] rounded flex items-center justify-center text-[11px] bg-surface-2 text-text-2">
            {p.iconEmoji}
          </div>
          <span>{p.code} {p.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedId === p.id ? 'bg-surface text-info-text' : 'bg-surface-2 text-text-2'}`}>
            {p._count?.drawings ?? 0}
          </span>
        </button>
      ))}
    </div>
  )
}
