import { useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { formatSGT, diffDays } from '../lib/dates'
import type { Drawing, LateReason } from '../types'

interface LateReasonModalProps {
  open: boolean
  drawing: Drawing | null
  onSubmit: (reason: LateReason, detail?: string) => void
  onClose: () => void
}

const LATE_REASONS: { value: LateReason; label: string }[] = [
  { value: 'CLIENT_SCOPE_CHANGE', label: 'Client scope change' },
  { value: 'CLIENT_DELAY', label: 'Client delay' },
  { value: 'SITE_CHANGE', label: 'Site change' },
  { value: 'VENDOR_DELAY', label: 'Vendor delay' },
  { value: 'SICK_LEAVE', label: 'Sick leave' },
  { value: 'AWAITING_OTHER_DISCIPLINE', label: 'Awaiting other discipline' },
  { value: 'SOFTWARE_ISSUE', label: 'Software issue' },
  { value: 'OTHER', label: 'Other' },
]

export function LateReasonModal({ open, drawing, onSubmit, onClose }: LateReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<LateReason | null>(null)
  const [detail, setDetail] = useState('')
  const [error, setError] = useState('')

  if (!drawing) return null

  const daysLate = diffDays(new Date().toISOString(), drawing.endDate)

  const handleSubmit = () => {
    if (!selectedReason) { setError('Please select a reason'); return }
    onSubmit(selectedReason, detail || undefined)
    setSelectedReason(null)
    setDetail('')
    setError('')
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader onClose={onClose}>
        <div className="w-9 h-9 rounded-full bg-warning-bg text-warning-text flex items-center justify-center text-lg">⚠️</div>
        <div>
          <div className="font-medium text-base">Late completion</div>
          <div className="text-xs text-text-2">{drawing.drawingNumber}</div>
        </div>
      </ModalHeader>

      <ModalBody>
        <p className="text-sm text-text-2 mb-3">
          This drawing's end date has passed. Please select a reason for the delay before marking it complete.
        </p>

        <div className="bg-danger-bg border-l-4 border-danger-border rounded-md px-3 py-2.5 mb-4 text-sm text-danger-text">
          <strong className="text-base">{Math.abs(daysLate)}d late</strong>
          <div className="text-xs mt-0.5">End date was {formatSGT(drawing.endDate)}</div>
        </div>

        <label className="block text-[11px] text-text-2 mb-2 font-medium uppercase tracking-wide">Reason *</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {LATE_REASONS.map(r => (
            <button
              key={r.value}
              onClick={() => setSelectedReason(r.value)}
              className={`text-xs px-3 py-1.5 border rounded-md transition-colors ${
                selectedReason === r.value
                  ? 'border-warning-border bg-warning-bg text-warning-text font-medium'
                  : 'border-border text-text-2 hover:border-border-strong bg-surface'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <label className="block text-[11px] text-text-2 mb-1 font-medium uppercase tracking-wide">Additional detail (optional)</label>
        <textarea
          value={detail}
          onChange={e => setDetail(e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-md text-text focus:outline-none focus:border-info-border min-h-[60px] resize-y"
          placeholder="Provide additional context…"
        />

        {error && <div className="mt-2 text-xs text-danger-text">{error}</div>}
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="warning" onClick={handleSubmit}>Mark complete</Button>
      </ModalFooter>
    </Modal>
  )
}
