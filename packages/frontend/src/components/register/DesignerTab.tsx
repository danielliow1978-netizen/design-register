import type { User } from '../../types'
import { Avatar } from '../ui/Pill'

interface DesignerTabProps {
  designers: User[]
  counts: Record<string, number>
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function DesignerTab({ designers, counts, selectedId, onSelect }: DesignerTabProps) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="flex gap-0.5 border-b border-border-strong mb-4 overflow-x-auto items-end">
      {/* All team tab */}
      <button
        onClick={() => onSelect(null)}
        className={`text-xs px-4 py-2.5 border-b-[3px] mb-[-1px] flex items-center gap-2 whitespace-nowrap rounded-t-md border-r border-border mr-1 pr-4 transition-colors ${
          selectedId === null
            ? 'text-info-text border-b-info-border bg-info-bg font-medium'
            : 'text-text-2 border-b-transparent hover:text-text'
        }`}
      >
        <span>👥</span>
        <span>All team</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedId === null ? 'bg-surface text-info-text' : 'bg-surface-2 text-text-2'}`}>
          {total}
        </span>
      </button>

      {designers.map(d => (
        <button
          key={d.id}
          onClick={() => onSelect(d.id)}
          className={`text-xs px-4 py-2.5 border-b-[3px] mb-[-1px] flex items-center gap-2 whitespace-nowrap rounded-t-md transition-colors ${
            selectedId === d.id
              ? 'text-info-text border-b-info-border bg-info-bg font-medium'
              : 'text-text-2 border-b-transparent hover:text-text'
          }`}
        >
          <Avatar initials={d.initials} color={d.avatarColor} size="sm" />
          <span>{d.fullName}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedId === d.id ? 'bg-surface text-info-text' : 'bg-surface-2 text-text-2'}`}>
            {counts[d.id] ?? 0}
          </span>
        </button>
      ))}
    </div>
  )
}
