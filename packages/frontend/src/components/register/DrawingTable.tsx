import { MouseEvent, useState, useRef, useEffect } from 'react'
import type { Drawing, SortColumn } from '../../types'
import { statusPill, categoryPill, Avatar } from '../ui/Pill'
import { Button } from '../ui/Button'
import { formatSGTShort } from '../../lib/dates'
import { drawingsApi } from '../../api/drawings'
import { useQueryClient } from '@tanstack/react-query'
import { ApprovalModal } from '../../modals/ApprovalModal'

interface DrawingTableProps {
  drawings: Drawing[]
  sortColumns: SortColumn[]
  onHeaderClick: (field: string, shiftKey: boolean) => void
  onComplete: (drawing: Drawing) => void
  onEdit: (drawing: Drawing) => void
  onDelete: (drawing: Drawing) => void
  onUpdateReason?: (id: string, reason: string) => void
  view: 'designer' | 'project'
  isLoading?: boolean
  currentUserId?: string
  currentUserRole?: string
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
  drawings, sortColumns, onHeaderClick, onComplete, onEdit, onDelete, onUpdateReason, view, isLoading,
  currentUserId, currentUserRole,
}: DrawingTableProps) {
  const queryClient = useQueryClient()
  const [editingReasonId, setEditingReasonId] = useState<string | null>(null)
  const [reasonDraft, setReasonDraft] = useState('')
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetId = useRef<string | null>(null)
  const [approvalTarget, setApprovalTarget] = useState<{ drawing: Drawing; action: 'APPROVED' | 'REJECTED' } | null>(null)

  // Scroll mirror refs
  const mainScrollRef = useRef<HTMLDivElement>(null)
  const topMirrorRef = useRef<HTMLDivElement>(null)
  const leftMirrorRef = useRef<HTMLDivElement>(null)
  const [mirrorScrollW, setMirrorScrollW] = useState(1700)
  const [mirrorScrollH, setMirrorScrollH] = useState(600)
  const syncing = useRef(false)

  useEffect(() => {
    const main = mainScrollRef.current
    const top = topMirrorRef.current
    const left = leftMirrorRef.current
    if (!main) return

    const updateDims = () => {
      setMirrorScrollW(main.scrollWidth)
      setMirrorScrollH(main.scrollHeight)
    }
    updateDims()
    const ro = new ResizeObserver(updateDims)
    ro.observe(main)

    const onMain = () => {
      if (syncing.current) return
      syncing.current = true
      if (top) top.scrollLeft = main.scrollLeft
      if (left) left.scrollTop = main.scrollTop
      syncing.current = false
    }
    const onTop = () => {
      if (syncing.current) return
      syncing.current = true
      main.scrollLeft = top!.scrollLeft
      syncing.current = false
    }
    const onLeft = () => {
      if (syncing.current) return
      syncing.current = true
      main.scrollTop = left!.scrollTop
      syncing.current = false
    }

    main.addEventListener('scroll', onMain)
    top?.addEventListener('scroll', onTop)
    left?.addEventListener('scroll', onLeft)
    return () => {
      main.removeEventListener('scroll', onMain)
      top?.removeEventListener('scroll', onTop)
      left?.removeEventListener('scroll', onLeft)
      ro.disconnect()
    }
  }, [])

  const handlePdfUpload = async (file: File) => {
    const id = uploadTargetId.current
    if (!id) return
    setUploadingId(id)
    setUploadProgress(0)
    setUploadError(null)
    try {
      await drawingsApi.uploadPdf(id, file, pct => setUploadProgress(pct))
      queryClient.invalidateQueries({ queryKey: ['drawings'] })
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } }
      setUploadError(apiErr.response?.data?.error || 'Upload failed')
    } finally {
      setUploadingId(null)
      setUploadProgress(0)
      uploadTargetId.current = null
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeletePdf = async (id: string) => {
    try {
      await drawingsApi.deletePdf(id)
      queryClient.invalidateQueries({ queryKey: ['drawings'] })
    } catch {
      // ignore
    }
  }

  const canApprove = ['DESIGN_MANAGER', 'PROJECT_MANAGER', 'DEPARTMENT_HEAD', 'COO', 'CEO', 'ADMIN'].includes(currentUserRole ?? '')

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

  const thc = (field: string, label: string) => {
    const idx = sortedIdx(field)
    const dir = sortDir(field)
    const isActive = idx >= 0
    return (
      <th
        key={field}
        onClick={(e: MouseEvent) => onHeaderClick(field, e.shiftKey)}
        className={`px-2 py-2 text-center text-[10px] font-medium uppercase tracking-[0.3px] whitespace-nowrap cursor-pointer select-none border-b border-border-strong transition-colors ${
          isActive ? 'bg-info-bg text-info-text' : 'bg-surface-2 text-text-2 hover:bg-info-bg hover:text-info-text'
        }`}
      >
        <span className="inline-flex items-center justify-center gap-0.5">
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

  const saveReason = (id: string) => {
    if (onUpdateReason) onUpdateReason(id, reasonDraft.trim())
    setEditingReasonId(null)
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
    <div className="border border-border rounded-md">
      {/* ── Top horizontal scroll mirror ── */}
      <div
        ref={topMirrorRef}
        className="overflow-x-scroll overflow-y-hidden rounded-t-md"
        style={{ height: 12 }}
      >
        <div style={{ width: mirrorScrollW, height: 1 }} />
      </div>

      <div className="flex">
        {/* ── Left vertical scroll mirror ── */}
        <div
          ref={leftMirrorRef}
          className="overflow-y-scroll overflow-x-hidden shrink-0 rounded-bl-md"
          style={{ width: 12, height: 'calc(100vh - 230px)' }}
        >
          <div style={{ height: mirrorScrollH, width: 1 }} />
        </div>

        {/* ── Main scroll area ── */}
        <div
          ref={mainScrollRef}
          className="overflow-auto flex-1 min-w-0 rounded-br-md"
          style={{ height: 'calc(100vh - 230px)' }}
        >
      {/* Hidden file input for PDF upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handlePdfUpload(file)
        }}
      />
      {uploadError && (
        <div className="px-3 py-2 text-xs text-danger-text bg-danger-bg border-b border-danger-border">
          ⚠ Upload failed: {uploadError}
          <button onClick={() => setUploadError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}
      <table className="w-full border-collapse text-[11px]" style={{ minWidth: 1700 }}>
        <thead>
          <tr>
            <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-[0.3px] bg-surface-2 text-text-2 border-b border-border-strong whitespace-nowrap w-16">
              Actions
            </th>
            <th className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-[0.3px] bg-surface-2 text-text-2 border-b border-border-strong whitespace-nowrap w-16">
              PDF
            </th>
            {thc('approvalStatus', 'Approval')}
            {thc('approvalDate', 'Approval Date')}
            {view === 'project' && (
              <th className="px-2.5 py-2 text-left text-[10px] font-medium uppercase tracking-[0.3px] whitespace-nowrap bg-surface-2 text-text-2 border-b border-border-strong">
                Designer
              </th>
            )}
            {HEADERS.map(h => th(h.field, h.label, h.locked))}
            <th className="px-2.5 py-2 text-center text-[10px] font-medium uppercase tracking-[0.3px] bg-surface-2 text-text-2 border-b border-border-strong whitespace-nowrap">
              Complete
            </th>
            <th className="px-2.5 py-2 text-left text-[10px] font-medium uppercase tracking-[0.3px] bg-surface-2 text-text-2 border-b border-border-strong whitespace-nowrap min-w-[180px]">
              Reason of delay
            </th>
          </tr>
        </thead>
        <tbody>
          {drawings.map(drawing => {
            const isCompleted = drawing.status === 'COMPLETED'
            const canAct = currentUserRole === 'ADMIN' || drawing.designerId === currentUserId
            const delay = drawing.delay ?? null
            const delayClass = delay === null
              ? 'text-text-3'
              : delay > 0
              ? 'bg-danger-bg text-danger-text'
              : 'bg-success-bg text-success-text'
            const delayLabel = delay === null ? '—' : delay > 0 ? `⚠ +${delay}d` : `✓ ${delay}d`
            const isEditingReason = editingReasonId === drawing.id

            return (
              <tr key={drawing.id} className="border-b border-border hover:bg-surface-2/50 transition-colors">
                <td className="px-2 py-2 align-middle whitespace-nowrap">
                  {(() => {
                    if (!canAct) return <span className="text-text-3 text-[10px]">—</span>
                    return (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEdit(drawing)}
                          className="w-6 h-6 flex items-center justify-center rounded text-text-2 hover:bg-info-bg hover:text-info-text transition-colors text-xs"
                          title="Edit drawing"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => onDelete(drawing)}
                          className="w-6 h-6 flex items-center justify-center rounded text-text-2 hover:bg-danger-bg hover:text-danger-text transition-colors text-xs"
                          title="Delete drawing"
                        >
                          🗑
                        </button>
                      </div>
                    )
                  })()}
                </td>

                {/* PDF column */}
                <td className="px-2 py-2 align-middle text-center whitespace-nowrap">
                  {uploadingId === drawing.id ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-12 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                        <div className="h-full bg-info-text transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <span className="text-[9px] text-text-3">{uploadProgress}%</span>
                    </div>
                  ) : drawing.pdfUrl ? (
                    <div className="flex items-center justify-center gap-1">
                      <a
                        href={drawing.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-6 h-6 flex items-center justify-center rounded bg-danger-bg text-danger-text hover:opacity-80 transition-opacity text-[11px]"
                        title="View PDF"
                      >
                        📄
                      </a>
                      {canAct && (
                        <button
                          onClick={() => handleDeletePdf(drawing.id)}
                          className="w-5 h-5 flex items-center justify-center rounded text-text-3 hover:bg-danger-bg hover:text-danger-text transition-colors text-[10px]"
                          title="Remove PDF"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ) : canAct ? (
                    <button
                      onClick={() => {
                        uploadTargetId.current = drawing.id
                        fileInputRef.current?.click()
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded text-text-3 hover:bg-info-bg hover:text-info-text transition-colors text-[11px] mx-auto"
                      title="Upload PDF"
                    >
                      ⬆
                    </button>
                  ) : (
                    <span className="text-text-3 text-[10px]">—</span>
                  )}
                </td>

                {/* Approval column */}
                <td className="px-2 py-2 align-middle text-center whitespace-nowrap">
                  {(!isCompleted || !['TENDER', 'SHOP'].includes(drawing.category)) ? (
                    <span className="text-text-3 text-[10px]">—</span>
                  ) : drawing.approvalStatus === 'APPROVED' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-bg text-success-text text-[10px] font-medium">
                      ✓ Approved
                    </span>
                  ) : drawing.approvalStatus === 'REJECTED' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger-bg text-danger-text text-[10px] font-medium">
                      ✕ Rejected
                    </span>
                  ) : canApprove ? (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setApprovalTarget({ drawing, action: 'APPROVED' })}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-success-bg text-success-text hover:opacity-80 transition-opacity"
                        title="Approve drawing"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setApprovalTarget({ drawing, action: 'REJECTED' })}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-danger-bg text-danger-text hover:opacity-80 transition-opacity"
                        title="Reject drawing"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span className="text-text-3 text-[10px] italic">Pending</span>
                  )}
                </td>

                {/* Approval Date column */}
                <td className="px-2 py-2 align-middle text-center whitespace-nowrap text-text-2 text-[11px]">
                  {drawing.approvalDate && ['TENDER', 'SHOP'].includes(drawing.category)
                    ? formatSGTShort(drawing.approvalDate)
                    : <span className="text-text-3">—</span>}
                </td>

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
                  {isCompleted ? (
                    <Button variant="ghost" size="sm" className="opacity-50 cursor-default" disabled>
                      ✓ Done
                    </Button>
                  ) : canAct ? (
                    <Button variant="success" size="sm" onClick={() => onComplete(drawing)}>
                      ✓ Complete
                    </Button>
                  ) : (
                    <span className="text-text-3 text-[10px]">—</span>
                  )}
                </td>

                {/* Reason of Delay — editable by designer/admin; read-only for others */}
                <td className="px-2.5 py-2 align-middle">
                  {isEditingReason ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        className="flex-1 px-2 py-1 text-[11px] bg-surface border border-info-border rounded text-text focus:outline-none min-w-0"
                        value={reasonDraft}
                        onChange={e => setReasonDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveReason(drawing.id)
                          if (e.key === 'Escape') setEditingReasonId(null)
                        }}
                        placeholder="Enter reason…"
                        maxLength={500}
                      />
                      <button
                        onClick={() => saveReason(drawing.id)}
                        className="shrink-0 w-6 h-6 flex items-center justify-center rounded bg-success-bg text-success-text text-xs hover:opacity-80"
                        title="Save"
                      >✓</button>
                      <button
                        onClick={() => setEditingReasonId(null)}
                        className="shrink-0 w-6 h-6 flex items-center justify-center rounded bg-surface-2 text-text-2 text-xs hover:opacity-80"
                        title="Cancel"
                      >✕</button>
                    </div>
                  ) : canAct ? (
                    <div
                      className="group flex items-center gap-1.5 cursor-pointer"
                      onClick={() => {
                        setEditingReasonId(drawing.id)
                        setReasonDraft(drawing.lateReasonDetail ?? '')
                      }}
                      title="Click to edit reason"
                    >
                      {drawing.lateReasonDetail ? (
                        <span className="text-warning-text text-[11px] leading-tight">{drawing.lateReasonDetail}</span>
                      ) : (
                        <span className="text-text-3 italic text-[11px]">Click to add reason…</span>
                      )}
                      <span className="opacity-0 group-hover:opacity-60 text-[10px] text-text-3 shrink-0">✎</span>
                    </div>
                  ) : (
                    <span className="text-[11px] leading-tight">
                      {drawing.lateReasonDetail
                        ? <span className="text-warning-text">{drawing.lateReasonDetail}</span>
                        : <span className="text-text-3">—</span>}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <ApprovalModal
        open={approvalTarget !== null}
        drawing={approvalTarget?.drawing ?? null}
        action={approvalTarget?.action ?? 'APPROVED'}
        onClose={() => setApprovalTarget(null)}
        onSuccess={() => {
          setApprovalTarget(null)
          queryClient.invalidateQueries({ queryKey: ['drawings'] })
        }}
      />
        </div>
      </div>
    </div>
  )
}
