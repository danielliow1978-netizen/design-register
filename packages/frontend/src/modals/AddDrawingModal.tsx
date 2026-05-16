import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { useAutosave } from '../hooks/useAutosave'
import { drawingsApi } from '../api/drawings'
import { projectsApi } from '../api/projects'
import { usersApi } from '../api/users'
import { draftsApi } from '../api/drafts'
import { useAuthStore } from '../store/authStore'
import type { DrawingDraft } from '../types'

interface AddDrawingModalProps {
  open: boolean
  onClose: () => void
  resumeDraft?: DrawingDraft
}

const DISCIPLINES = ['MECHANICAL', 'ELECTRICAL', 'ELV', 'FIRE_PROTECTION', 'PLUMBING']
const CATEGORIES = ['TENDER', 'SHOP', 'CONSTRUCTION', 'AS_BUILT']

interface DrawingFormData {
  drawingNumber: string
  drawingTitle: string
  projectId: string
  discipline: string
  category: string
  designerId: string
  requestorId: string
  requestDate: string
  startDate: string
  endDate: string
  notes: string
}

function getInitialForm(user: { id: string; discipline?: string } | null): DrawingFormData {
  return {
    drawingNumber: '',
    drawingTitle: '',
    projectId: '',
    discipline: user?.discipline || '',
    category: '',
    designerId: user?.id || '',
    requestorId: '',
    requestDate: new Date().toISOString().slice(0, 10),
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    notes: '',
  }
}

export function AddDrawingModal({ open, onClose, resumeDraft }: AddDrawingModalProps) {
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()
  const [draftId, setDraftId] = useState<string | undefined>(resumeDraft?.id)
  const [showResumeBanner, setShowResumeBanner] = useState(false)
  const [formData, setFormData] = useState<DrawingFormData>(() =>
    resumeDraft ? (resumeDraft.formData as unknown as DrawingFormData) : getInitialForm(user)
  )
  const [error, setError] = useState('')

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const { data: drafts = [] } = useQuery({ queryKey: ['drafts'], queryFn: draftsApi.list, enabled: open && !resumeDraft })

  // Check for existing drafts on open
  useEffect(() => {
    if (open && !resumeDraft && drafts.length > 0) {
      setShowResumeBanner(true)
    }
  }, [open, resumeDraft, drafts.length])

  // Auto-save
  const completionPct = Math.round(
    (Object.values(formData).filter(v => v && String(v).length > 0).length / Object.keys(formData).length) * 100
  )
  const { status: saveStatus, savedAgo, deleteDraft } = useAutosave(
    formData as unknown as Record<string, unknown>,
    completionPct,
    { draftId, onDraftCreated: (id) => setDraftId(id) }
  )

  const createMutation = useMutation({
    mutationFn: () => drawingsApi.create({
      ...formData,
      requestDate: new Date(formData.requestDate).toISOString(),
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString(),
    } as Parameters<typeof drawingsApi.create>[0]),
    onSuccess: async () => {
      await deleteDraft()
      queryClient.invalidateQueries({ queryKey: ['drawings'] })
      setFormData(getInitialForm(user))
      setDraftId(undefined)
      onClose()
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { error?: string } } }
      setError(apiErr.response?.data?.error || 'Failed to create drawing')
    },
  })

  const handleSubmit = () => {
    setError('')
    if (!formData.drawingNumber || !formData.drawingTitle || !formData.projectId || !formData.discipline || !formData.category || !formData.designerId || !formData.requestorId || !formData.endDate) {
      setError('Please fill in all required fields')
      return
    }
    createMutation.mutate()
  }

  const update = (field: keyof DrawingFormData, value: string) => setFormData(f => ({ ...f, [field]: value }))

  const inputClass = "w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-md text-text focus:outline-none focus:border-info-border transition-colors"
  const labelClass = "block text-[10px] text-text-2 mb-1 font-medium uppercase tracking-wide"
  const selectClass = inputClass + " cursor-pointer"

  const autosaveLabel = saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : saveStatus === 'saved' ? `Draft saved ${savedAgo}` : 'Draft will auto-save'
  const autosaveBg = saveStatus === 'saving' ? 'bg-info-bg border-info-border text-info-text' : saveStatus === 'error' ? 'bg-danger-bg border-danger-border text-danger-text' : 'bg-success-bg border-success-border text-success-text'

  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-2xl">
      <ModalHeader onClose={onClose}>
        <div className="w-9 h-9 rounded-full bg-info-bg text-info-text flex items-center justify-center text-lg">📐</div>
        <div>
          <div className="font-medium text-base">Add drawing</div>
          <div className="text-xs text-text-2">All dates are locked after creation</div>
        </div>
      </ModalHeader>

      <ModalBody>
        {/* Resume draft banner */}
        {showResumeBanner && drafts.length > 0 && (
          <div className="flex items-center justify-between bg-info-bg border border-info-border rounded-md px-3 py-2 mb-4 text-xs text-info-text">
            <span>📝 You have {drafts.length} saved draft{drafts.length > 1 ? 's' : ''}. Resume?</span>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={() => {
                const d = drafts[0]
                setFormData(d.formData as unknown as DrawingFormData)
                setDraftId(d.id)
                setShowResumeBanner(false)
              }}>
                Resume
              </Button>
              <Button size="sm" onClick={() => setShowResumeBanner(false)}>Dismiss</Button>
            </div>
          </div>
        )}

        {/* Autosave indicator */}
        <div className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md border mb-4 ${autosaveBg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saving' ? 'animate-pulse bg-info-text' : saveStatus === 'error' ? 'bg-danger-text' : 'bg-success-text'}`} />
          {autosaveLabel}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className={labelClass}>Drawing number *</label>
            <input className={inputClass} value={formData.drawingNumber} onChange={e => update('drawingNumber', e.target.value)} placeholder="PRJ-101-M-CD-001" />
          </div>
          <div>
            <label className={labelClass}>Project *</label>
            <select className={selectClass} value={formData.projectId} onChange={e => update('projectId', e.target.value)}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className={labelClass}>Drawing title *</label>
          <input className={inputClass} value={formData.drawingTitle} onChange={e => update('drawingTitle', e.target.value)} placeholder="e.g. AHU Plant Room L4 — Ductwork Layout" />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className={labelClass}>Discipline *</label>
            <select className={selectClass} value={formData.discipline} onChange={e => update('discipline', e.target.value)}>
              <option value="">Select…</option>
              {DISCIPLINES.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Category *</label>
            <select className={selectClass} value={formData.category} onChange={e => update('category', e.target.value)}>
              <option value="">Select…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', '-')}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Designer *</label>
            <select className={selectClass} value={formData.designerId} onChange={e => update('designerId', e.target.value)}>
              <option value="">Select…</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className={labelClass}>Requestor *</label>
          <select className={selectClass} value={formData.requestorId} onChange={e => update('requestorId', e.target.value)}>
            <option value="">Select requestor…</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.role.replace('_', ' ')})</option>)}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className={labelClass}>🔒 Request date *</label>
            <input type="date" className={inputClass} value={formData.requestDate} onChange={e => update('requestDate', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>🔒 Start date *</label>
            <input type="date" className={inputClass} value={formData.startDate} onChange={e => update('startDate', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>🔒 End date *</label>
            <input type="date" className={inputClass} value={formData.endDate} onChange={e => update('endDate', e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea className={inputClass + " min-h-[60px] resize-y"} value={formData.notes} onChange={e => update('notes', e.target.value)} placeholder="Optional notes…" />
        </div>

        <div className="mt-3 text-[10px] text-text-3 bg-surface-2 rounded-md px-3 py-2">
          🔒 Request, start, and end dates <strong>cannot be changed</strong> after the drawing is created.
        </div>

        {error && (
          <div className="mt-3 text-xs text-danger-text bg-danger-bg border border-danger-border rounded-md px-3 py-2">{error}</div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creating…' : 'Create drawing'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
