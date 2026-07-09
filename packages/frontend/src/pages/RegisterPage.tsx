import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ViewSwitcher } from '../components/register/ViewSwitcher'
import { DesignerTab } from '../components/register/DesignerTab'
import { ProjectTab } from '../components/register/ProjectTab'
import { DrawingTable } from '../components/register/DrawingTable'
import { ExportMenu } from '../components/ui/ExportMenu'
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
import { AddDrawingModal } from '../modals/AddDrawingModal'
import { AddProjectModal } from '../modals/AddProjectModal'
import { EditDrawingModal } from '../modals/EditDrawingModal'
import { LateReasonModal } from '../modals/LateReasonModal'
import { DeleteConfirmModal } from '../modals/DeleteConfirmModal'

const STATUS_FILTERS = ['ALL', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'] as const
type StatusFilter = typeof STATUS_FILTERS[number]

const APPROVAL_FILTERS = ['ALL', 'PENDING_APPROVAL', 'APPROVED'] as const
type ApprovalFilter = typeof APPROVAL_FILTERS[number]

// ── Shared filter bar ──────────────────────────────────────────────────────
function FilterBar({
  statusFilter, setStatusFilter,
  approvalFilter, setApprovalFilter,
  hideComplete, setHideComplete,
  statusCounts, approvalCounts,
}: {
  statusFilter: StatusFilter; setStatusFilter: (f: StatusFilter) => void
  approvalFilter: ApprovalFilter; setApprovalFilter: (f: ApprovalFilter) => void
  hideComplete: boolean; setHideComplete: (v: boolean) => void
  statusCounts: Record<string, number>; approvalCounts: Record<string, number>
}) {
  const STATUS_DOT: Record<string, string> = {
    IN_PROGRESS: '#3b82f6',
    COMPLETED: '#22c55e',
    OVERDUE: '#f43f5e',
  }
  const STATUS_LABEL: Record<string, string> = {
    ALL: 'All', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', OVERDUE: 'Overdue',
  }
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      {STATUS_FILTERS.map(f => (
        <button key={f}
          onClick={() => { setStatusFilter(f); setApprovalFilter('ALL') }}
          className={`fchip ${statusFilter === f && approvalFilter === 'ALL' ? 'fchip-all' : ''}`}
        >
          {f !== 'ALL' && (
            <span className="sdot" style={{ background: STATUS_DOT[f] }} />
          )}
          {STATUS_LABEL[f]} <strong className="font-semibold">{statusCounts[f] ?? 0}</strong>
        </button>
      ))}
      <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px', display: 'inline-block' }} />
      <button
        onClick={() => { setApprovalFilter('PENDING_APPROVAL'); setStatusFilter('ALL') }}
        className={`fchip ${approvalFilter === 'PENDING_APPROVAL' ? 'fchip-pend' : ''}`}
      >
        <svg style={{ width: 12, height: 12, flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        Pending approval <strong className="font-semibold">{approvalCounts.PENDING_APPROVAL ?? 0}</strong>
      </button>
      <button
        onClick={() => { setApprovalFilter('APPROVED'); setStatusFilter('ALL') }}
        className={`fchip ${approvalFilter === 'APPROVED' ? 'fchip-appr' : ''}`}
      >
        <svg style={{ width: 12, height: 12, flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Approved <strong className="font-semibold">{approvalCounts.APPROVED ?? 0}</strong>
      </button>
      <button
        onClick={() => {
          const next = !hideComplete
          setHideComplete(next)
          if (next && statusFilter === 'COMPLETED') setStatusFilter('ALL')
        }}
        className={`fchip ${hideComplete ? 'fchip-pend' : ''}`}
      >
        <svg style={{ width: 12, height: 12, flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          {hideComplete
            ? <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            : <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
          }
        </svg>
        {hideComplete ? 'Show completed' : 'Hide completed'}
      </button>
    </div>
  )
}

export default function RegisterPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = (searchParams.get('view') as 'designer' | 'project') || 'designer'
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()

  // Tab selection
  const [selectedDesignerId, setSelectedDesignerId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>('ALL')
  const [search, setSearch] = useState('')
  const [hideComplete, setHideComplete] = useState(false)

  // Sort
  const { sortColumns, handleHeaderClick, removeSort, sortString } = useSort('register', [
    { field: 'status', direction: 'asc' },
    { field: 'endDate', direction: 'asc' },
  ])

  // Grid view toggle (designer tab)
  const [designerGridView, setDesignerGridView] = useState(false)

  // Modals
  const [addOpen, setAddOpen] = useState(false)
  const [addProjectOpen, setAddProjectOpen] = useState(false)
  const [editDrawing, setEditDrawing] = useState<Drawing | null>(null)
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

  // Show all drawing-producing roles as designer tabs (exclude requestor-only @requestor.local accounts)
  const designers = users.filter(u =>
    ['DRAFTER', 'SENIOR_DRAFTER', 'DESIGNER', 'SENIOR_DESIGNER', 'PROJECT_ENGINEER',
     'ASSISTANT_DESIGN_MANAGER', 'DESIGN_MANAGER'].includes(u.role) &&
    !u.email.endsWith('@requestor.local')
  )

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

  // Update late reason mutation
  const updateReasonMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      drawingsApi.patch(id, { lateReasonDetail: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawings'] })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: ({ id, password, reason }: { id: string; password: string; reason: string }) =>
      drawingsApi.softDelete(id, password, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawings'] })
      queryClient.invalidateQueries({ queryKey: ['recycle'] })
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

  // Approval counts — only SHOP/TENDER drawings qualify for approval
  const approvalCounts = {
    PENDING_APPROVAL: allDrawings.filter(d =>
      ['SHOP', 'TENDER'].includes(d.category) &&
      d.status === 'COMPLETED' &&
      !d.approvalStatus &&
      (!selectedDesignerId || d.designerId === selectedDesignerId)
    ).length,
    APPROVED: allDrawings.filter(d =>
      d.approvalStatus === 'APPROVED' &&
      (!selectedDesignerId || d.designerId === selectedDesignerId)
    ).length,
  }

  // Info banner data
  const selectedDesigner = designers.find(d => d.id === selectedDesignerId)
  const selectedProject = projects.find(p => p.id === selectedProjectId)

  // Hide-complete filter: hides all COMPLETED drawings
  const afterHideComplete = hideComplete
    ? drawings.filter(d => d.status !== 'COMPLETED')
    : drawings

  // Approval filter
  const visibleDrawings = approvalFilter === 'ALL'
    ? afterHideComplete
    : approvalFilter === 'PENDING_APPROVAL'
      ? afterHideComplete.filter(d =>
          ['SHOP', 'TENDER'].includes(d.category) && d.status === 'COMPLETED' && !d.approvalStatus
        )
      : afterHideComplete.filter(d => d.approvalStatus === 'APPROVED')

  // Export handlers
  const filename = `DesignRegister_${view === 'designer' ? 'Designer' : 'Project'}_${formatSGT(new Date(), 'yyyy-MM-dd')}`

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      {/* ── Page top bar ── */}
      <header className="page-topbar">
        <h1 className="text-[15px] font-semibold text-text mr-auto flex items-center gap-2">
          Drawing Register
          <span className="text-[11px] font-medium text-text-3 bg-surface-2 border border-border px-2 py-0.5 rounded-full">
            {allDrawings.length} drawings
          </span>
        </h1>
        {/* View toggle */}
        <div className="flex items-center bg-surface-2 rounded-lg p-0.5 gap-0.5">
          <ViewSwitcher view={view} onChange={v => { setView(v); if (v !== 'designer') setDesignerGridView(false) }} />
        </div>
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3" style={{width:13,height:13}} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-[12px] bg-surface-2 border border-border rounded-lg w-44 focus:outline-none focus:border-info-border focus:bg-surface transition-all text-text placeholder-text-3"
            placeholder="Search drawings…" />
        </div>
        <ExportMenu onPdf={() => exportTableToPdf(drawings, filename, user?.pdfDefault)} onExcel={() => exportTableToExcel(drawings, filename)} onCsv={() => exportTableToCsv(drawings, filename)} />
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-[12px] font-semibold transition-all cursor-pointer"
          style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', boxShadow: '0 4px 14px rgba(37,99,235,.35)' }}
        >
          <svg style={{width:13,height:13}} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
          Add Drawing
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* ── KPI Summary Cards ── */}
        <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
          {[
            { label: 'Total Drawings', value: statusCounts.ALL, cls: 'kpi-total', color: 'text-text' },
            { label: 'In Progress',    value: statusCounts.IN_PROGRESS, cls: 'kpi-wip',  color: 'text-info-text' },
            { label: 'Completed',      value: statusCounts.COMPLETED,   cls: 'kpi-done', color: 'text-success-text' },
            { label: 'Overdue',        value: statusCounts.OVERDUE,     cls: 'kpi-overdue', color: 'text-danger-text' },
            { label: 'Pending Approval', value: approvalCounts.PENDING_APPROVAL, cls: 'kpi-pend', color: 'text-warning-text' },
          ].map(kpi => (
            <div key={kpi.label} className={`kpi-card ${kpi.cls}`}>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-2">{kpi.label}</div>
              <div className={`text-[30px] font-bold leading-none ${kpi.color}`}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* View switcher + grid toggle */}
        <div className="flex items-center gap-2 mb-3.5">
          <ViewSwitcher view={view} onChange={v => { setView(v); if (v !== 'designer') setDesignerGridView(false) }} />
          {view === 'designer' && (
            <button
              onClick={() => setDesignerGridView(g => !g)}
              title={designerGridView ? 'Switch to tab view' : 'Switch to grid view'}
              className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 border rounded-md transition-colors ${
                designerGridView
                  ? 'border-info-border bg-info-bg text-info-text'
                  : 'border-border bg-surface-2 text-text-2 hover:border-border-strong hover:text-text'
              }`}
            >
              {designerGridView ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                  Tab view
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                  </svg>
                  Grid view
                </>
              )}
            </button>
          )}
        </div>

        {/* ── Designer view: top-down layout ── */}
        {view === 'designer' && (
          <>
            <DesignerTab
              designers={designers}
              counts={designerCounts}
              selectedId={selectedDesignerId}
              onSelect={setSelectedDesignerId}
              allDrawings={allDrawings}
              gridView={designerGridView}
            />

            {selectedDesigner && (
              <div className="flex items-center justify-between bg-info-bg border border-info-border rounded-md px-4 py-3 mb-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center rounded-full text-white text-sm font-bold flex-shrink-0" style={{ width: 36, height: 36, background: selectedDesigner.avatarColor }}>{selectedDesigner.initials}</div>
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

            {/* Filter bar */}
            <FilterBar
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
              approvalFilter={approvalFilter} setApprovalFilter={setApprovalFilter}
              hideComplete={hideComplete} setHideComplete={setHideComplete}
              statusCounts={statusCounts} approvalCounts={approvalCounts}
            />

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

            <DrawingTable drawings={visibleDrawings} sortColumns={sortColumns} onHeaderClick={handleHeaderClick}
              onComplete={handleComplete} onEdit={d => setEditDrawing(d)} onDelete={d => setDeleteDrawing(d)}
              onUpdateReason={(id, reason) => updateReasonMutation.mutate({ id, reason })}
              isLoading={drawingsLoading} currentUserId={user?.id} currentUserRole={user?.role} />
          </>
        )}

        {/* ── Project view: side-by-side layout ── */}
        {view === 'project' && (
          <div className="flex gap-4 items-start">

            {/* Section A — left project panel (fixed width) */}
            <div className="w-72 shrink-0">
              <ProjectTab
                projects={projects}
                selectedId={selectedProjectId}
                onSelect={setSelectedProjectId}
                onAddProject={
                  ['DESIGN_MANAGER', 'DEPARTMENT_HEAD', 'ADMIN'].includes(user?.role ?? '')
                    ? () => setAddProjectOpen(true)
                    : undefined
                }
              />
            </div>

            {/* Section B — right content */}
            <div className="flex-1 min-w-0">
              {/* Project info banner */}
              {selectedProject && (
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
              <FilterBar
                statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                approvalFilter={approvalFilter} setApprovalFilter={setApprovalFilter}
                hideComplete={hideComplete} setHideComplete={setHideComplete}
                statusCounts={statusCounts} approvalCounts={approvalCounts}
              />

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

              <DrawingTable drawings={visibleDrawings} sortColumns={sortColumns} onHeaderClick={handleHeaderClick}
                onComplete={handleComplete} onEdit={d => setEditDrawing(d)} onDelete={d => setDeleteDrawing(d)}
                onUpdateReason={(id, reason) => updateReasonMutation.mutate({ id, reason })}
                isLoading={drawingsLoading} currentUserId={user?.id} currentUserRole={user?.role} />
            </div>
          </div>
        )}

        {/* Modals */}
        <AddDrawingModal open={addOpen} onClose={() => setAddOpen(false)} />
        <AddProjectModal
          open={addProjectOpen}
          onClose={() => setAddProjectOpen(false)}
          onCreated={id => setSelectedProjectId(id)}
        />
        <EditDrawingModal open={!!editDrawing} drawing={editDrawing} onClose={() => setEditDrawing(null)} />
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
