import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { drawingsApi } from '../api/drawings'
import { projectsApi } from '../api/projects'
import { usersApi } from '../api/users'
import { formatSGTShort } from '../lib/dates'
import { DISCIPLINES, DISCIPLINE_LABELS } from '../lib/disciplines'
import type { Drawing } from '../types'

interface EditDrawingModalProps {
  open: boolean
  drawing: Drawing | null
  onClose: () => void
}

const CATEGORIES = ['TENDER', 'SHOP', 'CONSTRUCTION', 'AS_BUILT']

interface EditFormData {
  drawingTitle: string
  discipline: string
  category: string
  designerId: string
  requestorId: string
  notes: string
}

function formFromDrawing(d: Drawing): EditFormData {
  return {
    drawingTitle: d.drawingTitle,
    discipline: d.discipline,
    category: d.category,
    designerId: d.designerId,
    requestorId: d.requestorId,
    notes: d.notes ?? '',
  }
}

export function EditDrawingModal({ open, drawing, onClose }: EditDrawingModalProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<EditFormData>(() =>
    drawing ? formFromDrawing(drawing) : { drawingTitle: '', discipline: '', category: '', designerId: '', requestorId: '', notes: '' }
  )
  const [error, setError] = useState('')

  // Reset form when the drawing changes
  useEffect(() => {
    if (drawing) setFormData(formFromDrawing(drawing))
    setError('')
  }, [drawing])

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })

  const patchMutation = useMutation({
    mutationFn: (data: EditFormData) =>
      drawingsApi.patch(drawing!.id, {
        drawingTitle: data.drawingTitle,
        discipline: data.discipline as Drawing['discipline'],
        category: data.category as Drawing['category'],
        designerId: data.designerId,
        requestorId: data.requestorId,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawings'] })
      onClose()
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { error?: string } } }
      setError(apiErr.response?.data?.error || 'Failed to save changes')
    },
  })

  const handleSubmit = () => {
    setError('')
    if (!formData.drawingTitle || !formData.discipline || !formData.category || !formData.designerId || !formData.requestorId) {
      setError('Please fill in all required fields')
      return
    }
    patchMutation.mutate(formData)
  }

  const update = (field: keyof EditFormData, value: string) =>
    setFormData(f => ({ ...f, [field]: value }))

  const inputClass = "w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-md text-text focus:outline-none focus:border-info-border transition-colors"
  const labelClass = "block text-[10px] text-text-2 mb-1 font-medium uppercase tracking-wide"
  const selectClass = inputClass + " cursor-pointer"

  if (!drawing) return null

  const projectName = projects.find(p => p.id === drawing.projectId)

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-2xl">
      <ModalHeader onClose={onClose}>
        <div className="w-9 h-9 rounded-full bg-info-bg text-info-text flex items-center justify-center text-lg">✎</div>
        <div>
          <div className="font-medium text-base">Edit drawing</div>
          <div className="text-xs text-text-2 font-mono">{drawing.drawingNumber}</div>
        </div>
      </ModalHeader>

      <ModalBody>
        {/* Locked fields (read-only info) */}
        <div className="bg-surface-2 border border-border rounded-md px-3 py-2.5 mb-4 text-[11px] text-text-3 flex flex-wrap gap-x-6 gap-y-1">
          <span>🔒 Drawing no.: <strong className="text-text-2">{drawing.drawingNumber}</strong></span>
          <span>🔒 Project: <strong className="text-text-2">{projectName?.code} — {projectName?.name}</strong></span>
          <span>🔒 Request: <strong className="text-text-2">{formatSGTShort(drawing.requestDate)}</strong></span>
          <span>🔒 Start: <strong className="text-text-2">{formatSGTShort(drawing.startDate)}</strong></span>
          <span>🔒 End: <strong className="text-text-2">{formatSGTShort(drawing.endDate)}</strong></span>
        </div>

        <div className="mb-3">
          <label className={labelClass}>Drawing title *</label>
          <input
            className={inputClass}
            value={formData.drawingTitle}
            onChange={e => update('drawingTitle', e.target.value)}
            placeholder="e.g. AHU Plant Room L4 — Ductwork Layout"
          />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className={labelClass}>Discipline *</label>
            {(() => {
              const isKnown = DISCIPLINES.includes(formData.discipline as typeof DISCIPLINES[number])
              const showCustom = !isKnown && formData.discipline !== ''
              const selectVal = showCustom ? '__custom__' : formData.discipline

              return (
                <>
                  <select
                    className={selectClass}
                    value={selectVal}
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        update('discipline', '')
                      } else {
                        update('discipline', e.target.value)
                      }
                    }}
                  >
                    <option value="">Select…</option>
                    {DISCIPLINES.map(d => (
                      <option key={d} value={d}>{DISCIPLINE_LABELS[d] ?? d.replace(/_/g, ' ')}</option>
                    ))}
                    <option value="__custom__">✏ Custom…</option>
                  </select>
                  {(selectVal === '__custom__' || showCustom) && (
                    <input
                      className={inputClass + " mt-1"}
                      placeholder="Type discipline name…"
                      value={formData.discipline}
                      autoFocus
                      onChange={e => update('discipline', e.target.value)}
                    />
                  )}
                </>
              )
            })()}
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
            {users.map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.role.replace(/_/g, ' ')})</option>)}
          </select>
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            className={inputClass + " min-h-[60px] resize-y"}
            value={formData.notes}
            onChange={e => update('notes', e.target.value)}
            placeholder="Optional notes…"
          />
        </div>

        {error && (
          <div className="mt-3 text-xs text-danger-text bg-danger-bg border border-danger-border rounded-md px-3 py-2">{error}</div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={patchMutation.isPending}>
          {patchMutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
