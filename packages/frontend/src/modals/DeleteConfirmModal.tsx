import { useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import type { Drawing } from '../types'

interface DeleteConfirmModalProps {
  open: boolean
  drawing: Drawing | null
  onConfirm: (password: string, reason: string) => void
  onClose: () => void
  isLoading?: boolean
}

export function DeleteConfirmModal({ open, drawing, onConfirm, onClose, isLoading }: DeleteConfirmModalProps) {
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  if (!drawing) return null

  const handleSubmit = () => {
    if (!password) { setError('Password is required'); return }
    if (!reason || reason.trim().length < 5) { setError('Please provide a reason (min 5 characters)'); return }
    setError('')
    onConfirm(password, reason)
  }

  const inputClass = "w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-md text-text focus:outline-none focus:border-danger-border transition-colors"
  const labelClass = "block text-[10px] text-text-2 mb-1 font-medium uppercase tracking-wide"

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader onClose={onClose}>
        <div className="w-9 h-9 rounded-full bg-danger-bg text-danger-text flex items-center justify-center text-lg">🗑</div>
        <div>
          <div className="font-medium text-base">Delete drawing</div>
          <div className="text-xs text-text-2">{drawing.drawingNumber}</div>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="bg-danger-bg border border-danger-border rounded-md px-3 py-2.5 mb-4 text-sm text-danger-text">
          <div className="font-medium">{drawing.drawingTitle}</div>
          <div className="text-xs mt-0.5 opacity-80">This drawing will be moved to the recycle bin. It can be restored for 30 days.</div>
        </div>

        <div className="mb-3">
          <label className={labelClass}>Reason for deletion *</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            className={inputClass + " min-h-[60px] resize-y"}
            placeholder="Why is this drawing being deleted?"
          />
        </div>

        <div className="mb-3">
          <label className={labelClass}>Your password (to confirm) *</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={inputClass}
            placeholder="Enter your password to confirm"
          />
        </div>

        {error && (
          <div className="text-xs text-danger-text bg-danger-bg border border-danger-border rounded-md px-3 py-2">{error}</div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Deleting…' : 'Move to recycle bin'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
