import { MouseEvent } from 'react'
import type { Drawing, SortColumn } from '../../types'
import { statusPill, categoryPill, Avatar } from '../ui/Pill'
import { Button } from '../ui/Button'
import { formatSGTShort } from '../../lib/dates'

interface DrawingTableProps {
  drawings: Drawing[]
  sortColumns: SortColumn[]
  onHeaderClick: (field: string, shiftKey: boolean) => void
  onComplete: (drawing: Drawing) => void
  onEdit: (drawing: Drawing) => void
  onDelete: (drawing: Drawing) => void
  view: 'designer' | 'project'
  isLoading?: boolean
}

const HEADERS: { field: string; label: string; locked?: boolean }[] = [
  { field: 'drawingNumber', label: 'Drawing no.' },
  { field: 'drawingTitle', label: 'Project / title' },
  { field: 'category', label: 'Cat.' },
  { field: 'requestorId', label: 'Requestor' },
  { field: 'requestDate', label: 'Request', locked: true },
  { field: 'startDate', label: 'Start', locked: true },
  { field: 'endDate', label: 'End', locked: true },
  { field: 'duration', label: 'Duration' },
  { field: 'actualCompletionDate', label: 'Completed' },
  { field: 'delay', label: 'Delay' },
  { field: 'status', label: 'Status' },
]

export function DrawingTable({
  drawings, sortColumns, onHeaderClick, onComplete, onEdit, onDelete, view, isLoading,
}: DrawingTableProps) {
  const sortedIdx = (field: string) => sortColumns.findIndex(s => s.field === field)
  const sortDir = (field: string) => sortColumns.find(s => s.field === field)?.direction

  const th = (field: string, label: string, locked?: boolean) => {
    const idx = sortedIdx(field)
    const dir = sortDir(field)
    const isActive = idx >= 0
    return (
      <th
        key={field}
        onClick={(e: MouseEvent) => onHeaderClick(field, e.shiftKey)}
        className={`px-2.5 py-2 text-left text-[10px] font-medium uppercase tracking-[0.3px] whitespace-nowrap cursor-pointer select-none border-b border-border-strong transition-colors ${
          isActive ? 'bg-info-bg text-info-text' : 'bg-surface-2 text-text-2 hover:bg-info-bg hover:text-info-text'
        }`}
      >
        <span className="relative inline-flex items-center">
          {locked && <span className="mr-1 text-[9px]">🔒</span>}
          {label}
          <span className="inline-flex flex-col ml-1 align-middle" style={{ fontSize: 8, lineHeight: '7px' }}>
            <span className={dir === 'asc' ? 'text-info-text font-bold' : 'text-text-3 opacity-50'}>▲</span>
            <span className={dir === 'desc' ? 'text-info-text font-bold' : 'text-text-3 opacity-50'}>▼</span>
          </span>
          {isActive && (
            <span className="ml-1 bg-info-text text-white text-[8px] rounded-full px-1 py-px font-medium">
              {idx + 1}
            </span>
          )}
        </span>
      </th>
    )
  }

  if (isLoading) {
    return (
      <div className="border border-border rounded-md overflow-hidden">
        <div className="py-12 text-center text-text-3 text-sm">Loading drawings…</div>
      </div>
    )
  }

  if (drawings.length === 0) {
    return (
      <div className="border border-border rounded-md overflow-hidden">
        <div className="py-12 text-center text-text-3 text-sm">No drawings found</div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto border border-border rounded-md">
      <table className="w-full border-collapse text-[11px]" style={{ minWidth: 1400 }}>
        <thead>
          <tr>
            {view === 'project' && (
              <th className="px-2.5 py-2 text-left text-[10px] font-medium uppercase tracking-[0.3px] whitespace-nowrap bg-surface-2 text-text-2 border-b border-border-strong">
                Designer
              </th>
            )}
            {HEADERS.map(h => th(h.field, h.label, h.locked))}
            <th className="px-2.5 py-2 text-center text-[10px] font-medium uppercase tracking-[0.3px] bg-surface-2 text-text-2 border-b border-border-strong whitespace-nowrap">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {drawings.map(drawing => {
            const isCompleted = drawing.status === 'COMPLETED'
            const delay = drawing.delay ?? null
            const delayClass = delay === null
              ? 'text-text-3'
              : delay > 0
              ? 'bg-danger-bg text-danger-text'
              : 'bg-success-bg text-success-text'
            const delayLabel = delay === null ? '—' : delay > 0 ? `⚠ +${delay}d` : `✓ ${delay}d`

            return (
              <tr key={drawing.id} className="border-b border-border hover:bg-surface-2/50 transition-colors">
                {view === 'project' && (
                  <td className="px-2.5 py-2 align-middle whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Avatar initials={drawing.designer.initials} color={drawing.designer.avatarColor} size="sm" />
                      <span className="text-text-2">{drawing.designer.fullName.split(' ')[0]}</span>
                    </div>
                  </td>
                )}
                <td className="px-2.5 py-2 align-middle font-medium whitespace-nowrap text-text">
                  {drawing.drawingNumber}
                </td>
                <td className="px-2.5 py-2 align-middle">
                  <div className="font-medium text-text">{drawing.project.name}</div>
                  <div className="text-text-3 text-[11px] mt-0.5">{drawing.drawingTitle}</div>
                </td>
                <td className="px-2.5 py-2 align-middle">{categoryPill(drawing.category)}</td>
                <td className="px-2.5 py-2 align-middle text-text-2">{drawing.requestor.fullName.split(' ')[0]}</td>
                <td className="px-2.5 py-2 align-middle bg-surface-2 text-text-2 whitespace-nowrap">
                  <span className="text-[9px] mr-1">🔒</span>{formatSGTShort(drawing.requestDate)}
                </td>
                <td className="px-2.5 py-2 align-middle bg-surface-2 text-text-2 whitespace-nowrap">
                  <span className="text-[9px] mr-1">🔒</span>{formatSGTShort(drawing.startDate)}
                </td>
                <td className="px-2.5 py-2 align-middle bg-surface-2 text-text-2 whitespace-nowrap">
                  <span className="text-[9px] mr-1">🔒</span>{formatSGTShort(drawing.endDate)}
                </td>
                <td className="px-2.5 py-2 align-middle text-center bg-info-bg text-info-text font-medium">
                  {drawing.duration != null ? `${drawing.duration}d` : '—'}
                </td>
                <td className="px-2.5 py-2 align-middle text-text-2">
                  {drawing.actualCompletionDate ? formatSGTShort(drawing.actualCompletionDate) : <span className="text-text-3">— pending —</span>}
                </td>
                <td className={`px-2.5 py-2 align-middle text-center font-medium whitespace-nowrap ${delayClass}`}>
                  {delayLabel}
                </td>
                <td className="px-2.5 py-2 align-middle">{statusPill(drawing.status)}</td>
                <td className="px-2.5 py-2 align-middle text-center whitespace-nowrap">
                  {!isCompleted ? (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => onComplete(drawing)}
                      className="mr-1"
                    >
                      ✓ Complete
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="mr-1 opacity-50 cursor-default" disabled>
                      ✓ Done
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => onEdit(drawing)} className="mr-1">✎</Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(drawing)}>🗑</Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
