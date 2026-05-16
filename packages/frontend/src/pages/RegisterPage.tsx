import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TopBar } from '../components/layout/TopBar'
import { ViewSwitcher } from '../components/register/ViewSwitcher'
import { DesignerTab } from '../components/register/DesignerTab'
import { ProjectTab } from '../components/register/ProjectTab'
import { DrawingTable } from '../components/register/DrawingTable'
import { ExportMenu } from '../components/ui/ExportMenu'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Pill'
import { useSort } from '../hooks/useSort'
import { drawingsApi } from '../api/drawings'
import { projectsApi } from '../api/projects'
import { usersApi } from '../api/users'
import { useAuthStore } from '../store/authStore'
import { exportTableToPdf } from '../lib/exportPdf'
import { exportTableToExcel } from '../lib/exportExcel'
import { exportTableToCsv } from '../lib/exportCsv'
import { formatSGT } from '../lib/dates'
import type { Drawing, LateReason } from '../types'

// Stub modals — replaced in Task 12
function AddDrawingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
      <div className="bg-surface rounded-lg p-6 max-w-lg w-full mx-4">
        <div className="font-medium mb-4">Add drawing (coming soon)</div>
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}

function LateReasonModal({ open, drawing, onSubmit, onClose }: {
  open: boolean
  drawing: Drawing | null
  onSubmit: (reason: LateReason, detail?: string) => void
  onClose: () => void
}) {
  if (!open || !drawing) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
      <div className="bg-surface rounded-lg p-6 max-w-sm w-full mx-4">
        <div className="font-medium mb-4">Late reason required</div>
        <Button variant="success" onClick={() => onSubmit('OTHER')}>Submit</Button>
        <Button onClick={onClose} className="ml-2">Cancel</Button>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ open, drawing, onConfirm, onClose }: {
  open: boolean
  drawing: Drawing | null
  onConfirm: (password: string, reason: string) => void
  onClose: () => void
}) {
  if (!open || !drawing) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
      <div className="bg-surface rounded-lg p-6 max-w-sm w-full mx-4">
        <div className="font-medium mb-4">Delete drawing</div>
        <Button variant="danger" onClick={() => onConfirm('Password123!', 'Test delete')}>Delete</Button>
        <Button onClick={onClose} className="ml-2">Cancel</Button>
      </div>
    </div>
  )
}

const STATUS_FILTERS = ['ALL', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'] as const
type StatusFilter = typeof STATUS_FILTERS[number]

export default function RegisterPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = (searchParams.get('view') as 'designer' | 'project') || 'designer'
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()

  // Tab selection
  const [selectedDesignerId, setSelectedDesignerId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [search, setSearch] = useState('')

  // Sort
  const { sortColumns, handleHeaderClick, removeSort, sortString } = useSort('register', [
    { field: 'status', direction: 'asc' },
    { field: 'endDate', direction: 'asc' },
  ])

  // Modals
  const [addOpen, setAddOpen] = useState(false)
  const [lateDrawing, setLateDrawing] = useState<Drawing | null>(null)
  const [deleteDrawing, setDeleteDrawing] = useState<Drawing | null>(null)

  const setView = (v: 'designer' | 'project') => {
    setSearchParams(prev => { prev.set('view', v); return prev }, { replace: true })
  }

  // Data fetching
  const { data: drawings = [], isLoading: drawingsLoading } = useQuery({
    queryKey: ['drawings', { designerId: selectedDesignerId, projectId: selectedProjectId, status: statusFilter === 'ALL' ? undefined : statusFilter, search: search || undefined, sort: sortString }],
    queryFn: () => drawingsApi.list({
      designerId: selectedDesignerId ?? undefined,
      projectId: selectedProjectId ?? undefined,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      search: search || undefined,
      sort: sortString || undefined,
    }),
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  })

  const designers = users.filter(u => ['DESIGNER', 'SENIOR_DESIGNER', 'DESIGN_MANAGER'].includes(u.role))

  // Drawing counts per designer/project
  const { data: allDrawings = [] } = useQuery({
    queryKey: ['drawings', 'all-counts'],
    queryFn: () => drawingsApi.list(),
  })
  const designerCounts: Record<string, number> = {}
  for (const d of allDrawings) {
    designerCounts[d.designerId] = (designerCounts[d.designerId] ?? 0) + 1
  }

  // Complete mutation
  const completeMutation = useMutation({
    mutationFn: ({ id, reason, detail }: { id: string; reason?: LateReason; detail?: string }) =>
      drawingsApi.complete(id, reason ? { lateReason: reason, lateReasonDetail: detail } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawings'] })
      setLateDrawing(null)
    },
    onError: (err: any) => {
      if (err.response?.data?.code === 'LATE_REASON_REQUIRED') {
        // Keep lateDrawing set — modal stays open
      }
    },
  })

  const handleComplete = async (drawing: Drawing) => {
    try {
      await completeMutation.mutateAsync({ id: drawing.id })
    } catch (err: any) {
      if (err.response?.data?.code === 'LATE_REASON_REQUIRED') {
        setLateDrawing(drawing)
      }
    }
  }

  const handleLateReasonSubmit = (reason: LateReason, detail?: string) => {
    if (lateDrawing) {
      completeMutation.mutate({ id: lateDrawing.id, reason, detail })
    }
  }

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: ({ id, password, reason }: { id: string; password: string; reason: string }) =>
      drawingsApi.softDelete(id, password, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawings'] })
      setDeleteDrawing(null)
    },
  })

  // Status counts for filter chips
  const statusCounts = {
    ALL: allDrawings.filter(d => !selectedDesignerId || d.designerId === selectedDesignerId).length,
    IN_PROGRESS: allDrawings.filter(d => d.status === 'IN_PROGRESS' && (!selectedDesignerId || d.designerId === selectedDesignerId)).length,
    COMPLETED: allDrawings.filter(d => d.status === 'COMPLETED' && (!selectedDesignerId || d.designerId === selectedDesignerId)).length,
    OVERDUE: allDrawings.filter(d => d.status === 'OVERDUE' && (!selectedDesignerId || d.designerId === selectedDesignerId)).length,
  }

  // Info banner data
  const selectedDesigner = designers.find(d => d.id === selectedDesignerId)
  const selectedProject = projects.find(p => p.id === selectedProjectId)

  // Export handlers
  const filename = `DesignRegister_${view === 'designer' ? 'Designer' : 'Project'}_${formatSGT(new Date(), 'yyyy-MM-dd')}`

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-[1280px] mx-auto px-6 py-6">
        <TopBar />

        {/* View switcher */}
        <ViewSwitcher view={view} onChange={setView} />

        {/* Tabs */}
        {view === 'designer' ? (
          <DesignerTab
            designers={designers}
            counts={designerCounts}
            selectedId={selectedDesignerId}
            onSelect={setSelectedDesignerId}
          />
        ) : (
          <ProjectTab
            projects={projects}
            selectedId={selectedProjectId}
            onSelect={setSelectedProjectId}
          />
        )}

        {/* Info banner */}
        {view === 'designer' && selectedDesigner && (
          <div className="flex items-center justify-between bg-info-bg border border-info-border rounded-md px-4 py-3 mb-3.5">
            <div className="flex items-center gap-3">
              <Avatar initials={selectedDesigner.initials} color={selectedDesigner.avatarColor} size="lg" />
              <div>
                <div className="font-medium text-sm text-info-text">{selectedDesigner.fullName}'s drawing register</div>
                <div className="text-[11px] text-text-2 mt-0.5">{selectedDesigner.discipline?.replace('_', ' ')} · {selectedDesigner.role.replace('_', ' ')} · {designerCounts[selectedDesigner.id] ?? 0} total drawings</div>
              </div>
            </div>
            <div className="flex gap-4 text-[11px]">
              {[
                { label: 'In progress', count: statusCounts.IN_PROGRESS, color: 'text-info-text' },
                { label: 'Completed', count: statusCounts.COMPLETED, color: 'text-success-text' },
                { label: 'Overdue', count: statusCounts.OVERDUE, color: 'text-danger-text' },
              ].map(stat => (
                <div key={stat.label} className="text-center">
                  <div className="text-text-3">{stat.label}</div>
                  <div className={`text-base font-medium mt-0.5 ${stat.color}`}>{stat.count}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'project' && selectedProject && (
          <div className="flex items-center justify-between bg-teal-bg border border-teal-text/30 rounded-md px-4 py-3 mb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-[38px] h-[38px] rounded-md bg-surface flex items-center justify-center text-xl">
                {selectedProject.iconEmoji}
              </div>
              <div>
                <div className="font-medium text-sm text-teal-text">{selectedProject.code} — {selectedProject.name}</div>
                <div className="text-[11px] text-text-2 mt-0.5">{selectedProject.client} · {selectedProject.contractType}</div>
              </div>
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`text-[11px] px-2.5 py-1 border rounded-md transition-colors ${
                  statusFilter === f
                    ? 'border-info-border bg-info-bg text-info-text'
                    : 'border-border text-text-2 hover:border-border-strong'
                }`}
              >
                {f === 'ALL' ? 'All' : f === 'IN_PROGRESS' ? 'In progress' : f.charAt(0) + f.slice(1).toLowerCase()} · {statusCounts[f]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search..."
              className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-surface text-text placeholder-text-3 w-48 focus:outline-none focus:border-info-border"
            />
            <ExportMenu
              onPdf={() => exportTableToPdf(drawings, filename, user?.pdfDefault)}
              onExcel={() => exportTableToExcel(drawings, filename)}
              onCsv={() => exportTableToCsv(drawings, filename)}
            />
            <Button variant="primary" onClick={() => setAddOpen(true)}>+ Add drawing</Button>
          </div>
        </div>

        {/* Active sort bar */}
        {sortColumns.length > 0 && (
          <div className="flex items-center gap-2 bg-info-bg border border-info-border rounded-md px-2.5 py-1.5 mb-2.5 text-[11px] text-info-text flex-wrap">
            <span>Sorted by:</span>
            {sortColumns.map((col, i) => (
              <span key={col.field} className="inline-flex items-center gap-1 bg-surface border border-info-border rounded px-2 py-0.5">
                <span className="bg-info-text text-white text-[8px] rounded-full px-1 font-medium">{i + 1}</span>
                <span>{col.field}</span>
                <span className="font-medium">{col.direction === 'asc' ? '▲ asc' : '▼ desc'}</span>
                <button onClick={() => removeSort(col.field)} className="opacity-60 hover:opacity-100 ml-1 text-xs">✕</button>
              </span>
            ))}
            <span className="ml-auto text-[11px] opacity-70">💡 Shift+click to add secondary sort</span>
          </div>
        )}

        {/* Table */}
        <DrawingTable
          drawings={drawings}
          sortColumns={sortColumns}
          onHeaderClick={handleHeaderClick}
          onComplete={handleComplete}
          onEdit={d => console.log('edit', d.id)}
          onDelete={d => setDeleteDrawing(d)}
          view={view}
          isLoading={drawingsLoading}
        />

        {/* Modals */}
        <AddDrawingModal open={addOpen} onClose={() => setAddOpen(false)} />
        <LateReasonModal
          open={!!lateDrawing}
          drawing={lateDrawing}
          onSubmit={handleLateReasonSubmit}
          onClose={() => setLateDrawing(null)}
        />
        <DeleteConfirmModal
          open={!!deleteDrawing}
          drawing={deleteDrawing}
          onConfirm={(pw, reason) => deleteMutation.mutate({ id: deleteDrawing!.id, password: pw, reason })}
          onClose={() => setDeleteDrawing(null)}
        />
      </div>
    </div>
  )
}
