import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TopBar } from '../components/layout/TopBar'
import { Button } from '../components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal'
import { statusPill, categoryPill, Avatar } from '../components/ui/Pill'
import { recycleApi } from '../api/recycle'
import { useAuthStore } from '../store/authStore'
import { formatSGT, diffDays } from '../lib/dates'
import type { Drawing } from '../types'

export default function RecycleBinPage() {
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()
  const [purgeTarget, setPurgeTarget] = useState<Drawing | null>(null)
  const [purgePassword, setPurgePassword] = useState('')
  const [purgeError, setPurgeError] = useState('')

  const { data: drawings = [], isLoading } = useQuery({
    queryKey: ['recycle'],
    queryFn: recycleApi.list,
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => recycleApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recycle'] })
      queryClient.invalidateQueries({ queryKey: ['drawings'] })
    },
  })

  const purgeMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      recycleApi.purge(id, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recycle'] })
      setPurgeTarget(null)
      setPurgePassword('')
      setPurgeError('')
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } }
      setPurgeError(e.response?.data?.error || 'Failed to purge')
    },
  })

  const isDeptHead = user?.role === 'DEPARTMENT_HEAD' || user?.role === 'ADMIN'

  const daysLeft = (drawing: Drawing) => {
    if (!drawing.deletedAt) return 30
    const deleted = new Date(drawing.deletedAt)
    const expires = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000)
    return Math.max(0, diffDays(expires.toISOString(), new Date().toISOString()))
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-[1280px] mx-auto px-6 py-6">
        <TopBar />

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-medium text-text">🗑 Recycle bin</h2>
            <p className="text-xs text-text-3 mt-0.5">Soft-deleted drawings · Auto-purged after 30 days</p>
          </div>
          <span className="text-xs text-text-3">{drawings.length} drawing{drawings.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-text-3">Loading…</div>
        ) : drawings.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg py-16 text-center">
            <div className="text-3xl mb-2">✅</div>
            <div className="text-sm text-text-2">Recycle bin is empty</div>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  {['Drawing no.', 'Title', 'Project', 'Designer', 'Cat.', 'Status', 'Deleted', 'Reason', 'Expires in', 'Actions'].map(h => (
                    <th key={h} className="px-2.5 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-text-3 bg-surface-2 border-b border-border-strong whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drawings.map(drawing => {
                  const remaining = daysLeft(drawing)
                  const urgentExpiry = remaining <= 3
                  return (
                    <tr key={drawing.id} className="border-b border-border hover:bg-surface-2/50">
                      <td className="px-2.5 py-2 font-medium text-text whitespace-nowrap">{drawing.drawingNumber}</td>
                      <td className="px-2.5 py-2 text-text-2 max-w-[200px] truncate">{drawing.drawingTitle}</td>
                      <td className="px-2.5 py-2 text-text-2 whitespace-nowrap">{drawing.project.code}</td>
                      <td className="px-2.5 py-2">
                        <div className="flex items-center gap-1.5">
                          <Avatar initials={drawing.designer.initials} color={drawing.designer.avatarColor} size="sm" />
                          <span className="text-text-2">{drawing.designer.fullName.split(' ')[0]}</span>
                        </div>
                      </td>
                      <td className="px-2.5 py-2">{categoryPill(drawing.category)}</td>
                      <td className="px-2.5 py-2">{statusPill(drawing.status)}</td>
                      <td className="px-2.5 py-2 text-text-3 whitespace-nowrap">
                        {drawing.deletedAt ? formatSGT(drawing.deletedAt) : '—'}
                      </td>
                      <td className="px-2.5 py-2 text-text-3 max-w-[150px] truncate">{drawing.deletedReason || '—'}</td>
                      <td className={`px-2.5 py-2 font-medium whitespace-nowrap ${urgentExpiry ? 'text-danger-text' : 'text-text-2'}`}>
                        {remaining}d
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => restoreMutation.mutate(drawing.id)}
                          disabled={restoreMutation.isPending}
                          className="mr-1"
                        >
                          ♻️ Restore
                        </Button>
                        {isDeptHead && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => { setPurgeTarget(drawing); setPurgePassword(''); setPurgeError('') }}
                          >
                            💀 Purge
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Purge confirmation modal */}
        <Modal open={!!purgeTarget} onClose={() => { setPurgeTarget(null); setPurgePassword('') }}>
          <ModalHeader onClose={() => setPurgeTarget(null)}>
            <div className="w-9 h-9 rounded-full bg-danger-bg text-danger-text flex items-center justify-center text-lg">💀</div>
            <div>
              <div className="font-medium text-base">Permanently delete</div>
              <div className="text-xs text-text-2">{purgeTarget?.drawingNumber}</div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="bg-danger-bg border border-danger-border rounded-md px-3 py-2.5 mb-4 text-sm text-danger-text">
              <div className="font-medium">This cannot be undone.</div>
              <div className="text-xs mt-1 opacity-80">{purgeTarget?.drawingTitle} will be permanently deleted from the database.</div>
            </div>
            <label className="block text-[10px] text-text-2 mb-1 font-medium uppercase tracking-wide">Your password to confirm *</label>
            <input
              type="password"
              value={purgePassword}
              onChange={e => setPurgePassword(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-md text-text focus:outline-none focus:border-danger-border"
              placeholder="Enter password"
            />
            {purgeError && <div className="mt-2 text-xs text-danger-text">{purgeError}</div>}
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setPurgeTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!purgeTarget || !purgePassword) { setPurgeError('Password required'); return }
                purgeMutation.mutate({ id: purgeTarget.id, password: purgePassword })
              }}
              disabled={purgeMutation.isPending}
            >
              {purgeMutation.isPending ? 'Deleting…' : 'Permanently delete'}
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </div>
  )
}
