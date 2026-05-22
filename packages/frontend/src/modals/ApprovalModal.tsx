import { useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { drawingsApi } from '../api/drawings'
import type { Drawing } from '../types'

interface ApprovalModalProps {
  open: boolean
  drawing: Drawing | null
  action: 'APPROVED' | 'REJECTED'
  onClose: () => void
  onSuccess: () => void
}

export function ApprovalModal({ open, drawing, action, onClose, onSuccess }: ApprovalModalProps) {
  const [comment, setComment] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!drawing) return null

  const isApprove = action === 'APPROVED'
  const title = isApprove ? 'Approve Drawing' : 'Reject Drawing'
  const icon = isApprove ? '✅' : '❌'
  const confirmLabel = isApprove ? 'Confirm Approval' : 'Confirm Rejection'
  const confirmVariant = isApprove ? 'success' : 'danger'

  const handleClose = () => {
    setComment('')
    setError(null)
    onClose()
  }

  const handleSubmit = async () => {
    if (!isApprove && !comment.trim()) {
      setError('A comment is required when rejecting a drawing.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      await drawingsApi.approve(drawing.id, {
        status: action,
        comment: comment.trim() || undefined,
      })
      setComment('')
      onSuccess()
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } }
      setError(apiErr.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass = "w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-md text-text focus:outline-none focus:border-info-border transition-colors"
  const labelClass = "block text-[10px] text-text-2 mb-1 font-medium uppercase tracking-wide"

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalHeader onClose={handleClose}>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg ${isApprove ? 'bg-success-bg' : 'bg-danger-bg'}`}>
          {icon}
        </div>
        <div>
          <div className="font-medium text-base">{title}</div>
          <div className="text-xs text-text-2">{drawing.drawingNumber}</div>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className={`border rounded-md px-3 py-2.5 mb-4 text-sm ${isApprove ? 'bg-success-bg border-success-border text-success-text' : 'bg-danger-bg border-danger-border text-danger-text'}`}>
          <div className="font-medium">{drawing.drawingTitle}</div>
          <div className="text-xs mt-0.5 opacity-80">{drawing.project?.name}</div>
        </div>

        <div className="mb-3">
          <label className={labelClass}>
            Comment {isApprove ? '(optional)' : <span className="text-danger-text">(required)</span>}
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            className={inputClass + ' min-h-[80px] resize-y'}
            placeholder={isApprove ? 'Add a comment (optional)…' : 'Reason for rejection (required)…'}
            maxLength={1000}
          />
        </div>

        {error && (
          <div className="text-xs text-danger-text bg-danger-bg border border-danger-border rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button onClick={handleClose} disabled={isLoading}>Cancel</Button>
        <Button variant={confirmVariant} onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Saving…' : confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
