import type { User, Drawing } from '../../types'
import { Avatar } from '../ui/Pill'

interface DesignerTabProps {
  designers: User[]
  counts: Record<string, number>
  selectedId: string | null
  onSelect: (id: string | null) => void
  allDrawings?: Drawing[]
  gridView?: boolean
}

const ROLE_LABELS: Record<string, string> = {
  DRAFTER: 'Drafter',
  SENIOR_DRAFTER: 'Senior Drafter',
  DESIGNER: 'Designer',
  SENIOR_DESIGNER: 'Senior Designer',
  PROJECT_ENGINEER: 'Project Engineer',
  QS_DEPARTMENT: 'QS Department',
  ASSISTANT_DESIGN_MANAGER: 'Asst. Design Mgr',
  DESIGN_MANAGER: 'Design Manager',
}

export function DesignerTab({ designers, counts, selectedId, onSelect, allDrawings = [], gridView = false }: DesignerTabProps) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  // Compute per-designer status counts from allDrawings
  const statusCounts: Record<string, { inProgress: number; completed: number; overdue: number }> = {}
  for (const d of allDrawings) {
    if (!statusCounts[d.designerId]) {
      statusCounts[d.designerId] = { inProgress: 0, completed: 0, overdue: 0 }
    }
    if (d.status === 'IN_PROGRESS') statusCounts[d.designerId].inProgress++
    else if (d.status === 'COMPLETED') statusCounts[d.designerId].completed++
    else if (d.status === 'OVERDUE') statusCounts[d.designerId].overdue++
  }

  // Overall status totals for "All team" card
  const allStatus = allDrawings.reduce(
    (acc, d) => {
      if (d.status === 'IN_PROGRESS') acc.inProgress++
      else if (d.status === 'COMPLETED') acc.completed++
      else if (d.status === 'OVERDUE') acc.overdue++
      return acc
    },
    { inProgress: 0, completed: 0, overdue: 0 }
  )

  if (gridView) {
    return (
      <div className="mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* All team card */}
          <button
            onClick={() => onSelect(null)}
            className={`flex flex-col items-center text-center px-3 py-4 rounded-lg border-2 transition-all hover:shadow-sm ${
              selectedId === null
                ? 'border-info-border bg-info-bg'
                : 'border-border bg-surface hover:border-border-strong'
            }`}
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl mb-2 ${
              selectedId === null ? 'bg-surface' : 'bg-surface-2'
            }`}>
              👥
            </div>
            <div className={`text-xs font-medium mb-0.5 ${selectedId === null ? 'text-info-text' : 'text-text'}`}>
              All team
            </div>
            <div className={`text-[10px] mb-2 ${selectedId === null ? 'text-info-text/70' : 'text-text-3'}`}>
              {total} drawings
            </div>
            <div className="flex gap-2 text-[10px]">
              <span className="text-info-text font-medium">{allStatus.inProgress}</span>
              <span className="text-success-text font-medium">{allStatus.completed}</span>
              <span className="text-danger-text font-medium">{allStatus.overdue}</span>
            </div>
            <div className="flex gap-2 text-[9px] text-text-3 mt-0.5">
              <span>WIP</span>
              <span>Done</span>
              <span>Late</span>
            </div>
          </button>

          {designers.map(d => {
            const count = counts[d.id] ?? 0
            const sc = statusCounts[d.id] ?? { inProgress: 0, completed: 0, overdue: 0 }
            const isSelected = selectedId === d.id
            return (
              <button
                key={d.id}
                onClick={() => onSelect(d.id)}
                className={`flex flex-col items-center text-center px-3 py-4 rounded-lg border-2 transition-all hover:shadow-sm ${
                  isSelected
                    ? 'border-info-border bg-info-bg'
                    : 'border-border bg-surface hover:border-border-strong'
                }`}
              >
                <div className="mb-2">
                  <Avatar initials={d.initials} color={d.avatarColor} size="lg" />
                </div>
                <div className={`text-xs font-medium mb-0.5 leading-tight ${isSelected ? 'text-info-text' : 'text-text'}`}>
                  {d.fullName}
                </div>
                <div className={`text-[9px] mb-2 ${isSelected ? 'text-info-text/70' : 'text-text-3'}`}>
                  {ROLE_LABELS[d.role] ?? d.role}
                </div>
                <div className={`text-[10px] mb-2 ${isSelected ? 'text-info-text/70' : 'text-text-3'}`}>
                  {count} drawing{count !== 1 ? 's' : ''}
                </div>
                <div className={`w-full rounded-md px-2 py-1.5 ${sc.inProgress === 0 ? 'bg-danger-bg' : ''}`}>
                  <div className="flex gap-2 text-[10px] justify-center">
                    <span className="text-info-text font-medium">{sc.inProgress}</span>
                    <span className="text-success-text font-medium">{sc.completed}</span>
                    <span className="text-danger-text font-medium">{sc.overdue}</span>
                  </div>
                  <div className="flex gap-2 text-[9px] text-text-3 mt-0.5 justify-center">
                    <span>WIP</span>
                    <span>Done</span>
                    <span>Late</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Tab view (default)
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
