import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TopBar } from '../components/layout/TopBar'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Pill'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal'
import { usersApi } from '../api/users'
import type { AvatarColor } from '../types'

const AVATAR_COLORS: AvatarColor[] = ['info', 'success', 'warning', 'danger', 'purple', 'teal', 'neutral']
const COLOR_BG: Record<AvatarColor, string> = {
  info: 'bg-info-bg',
  success: 'bg-success-bg',
  warning: 'bg-warning-bg',
  danger: 'bg-danger-bg',
  purple: 'bg-purple-bg',
  teal: 'bg-teal-bg',
  neutral: 'bg-surface-2',
}

interface AddForm {
  fullName: string
  initials: string
  avatarColor: AvatarColor
}

const EMPTY_FORM: AddForm = { fullName: '', initials: '', avatarColor: 'info' }

export default function RequestorPage() {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<AddForm>(EMPTY_FORM)
  const [addError, setAddError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  // Fetch all users and filter to requestor-only accounts
  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  })
  const requestors = allUsers.filter(u => u.email.endsWith('@requestor.local'))

  const addMutation = useMutation({
    mutationFn: () =>
      usersApi.create({
        fullName: form.fullName.trim(),
        initials: form.initials.trim().toUpperCase(),
        avatarColor: form.avatarColor,
        // email, password, role, discipline auto-generated/defaulted server-side
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setForm(EMPTY_FORM)
      setAddError('')
      setShowAdd(false)
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } }
      setAddError(e.response?.data?.error || 'Failed to add requestor')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setConfirmDeleteId(null)
      setDeleteError('')
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } }
      setDeleteError(e.response?.data?.error || 'Failed to delete requestor')
      setConfirmDeleteId(null)
    },
  })

  const handleAdd = () => {
    if (!form.fullName.trim()) { setAddError('Full name is required'); return }
    if (!form.initials.trim() || form.initials.trim().length < 2) { setAddError('Initials must be 2–3 letters'); return }
    setAddError('')
    addMutation.mutate()
  }

  const inputClass = "w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-md text-text focus:outline-none focus:border-info-border transition-colors"
  const labelClass = "block text-[10px] text-text-2 mb-1 font-medium uppercase tracking-wide"

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-[1280px] mx-auto px-6 py-6">
        <TopBar />

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-medium text-text">🙋 Requestors</h2>
            <p className="text-xs text-text-3 mt-0.5">{requestors.length} requestor{requestors.length !== 1 ? 's' : ''} · Isolated from Team members</p>
          </div>
          <Button variant="primary" onClick={() => { setForm(EMPTY_FORM); setAddError(''); setShowAdd(true) }}>
            + Add requestor
          </Button>
        </div>

        {deleteError && (
          <div className="mb-3 text-xs text-danger-text bg-danger-bg border border-danger-border rounded-md px-3 py-2">
            {deleteError}
          </div>
        )}

        {isLoading ? (
          <div className="py-12 text-center text-text-3">Loading…</div>
        ) : requestors.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg py-16 text-center">
            <div className="text-3xl mb-2">🙋</div>
            <div className="text-sm text-text-2">No requestors yet</div>
            <div className="text-xs text-text-3 mt-1">Add requestors such as clients, project managers, or COO/CEO</div>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  {['Requestor', 'Actions'].map(h => (
                    <th key={h} className={`px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide text-text-3 bg-surface-2 border-b border-border-strong ${h === 'Actions' ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requestors.map(r => {
                  const isConfirming = confirmDeleteId === r.id
                  return (
                    <tr key={r.id} className="border-b border-border hover:bg-surface-2/50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={r.initials} color={r.avatarColor} size="sm" />
                          <span className="font-medium text-text">{r.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {isConfirming ? (
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <span className="text-text-2 mr-1">Delete?</span>
                            <button
                              onClick={() => deleteMutation.mutate(r.id)}
                              disabled={deleteMutation.isPending}
                              className="px-2 py-0.5 bg-danger-bg text-danger-text border border-danger-border rounded text-[11px] hover:opacity-80"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-0.5 bg-surface-2 text-text-2 border border-border rounded text-[11px] hover:opacity-80"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => { setDeleteError(''); setConfirmDeleteId(r.id) }}
                            className="w-7 h-7 inline-flex items-center justify-center rounded text-text-3 hover:bg-danger-bg hover:text-danger-text transition-colors"
                            title="Delete requestor"
                          >
                            🗑
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Requestor Modal */}
        <Modal open={showAdd} onClose={() => setShowAdd(false)} maxWidth="max-w-sm">
          <ModalHeader onClose={() => setShowAdd(false)}>
            <div className="w-9 h-9 rounded-full bg-info-bg text-info-text flex items-center justify-center text-lg">🙋</div>
            <div>
              <div className="font-medium text-base">Add requestor</div>
              <div className="text-xs text-text-2">Add a client, PM, or other external requestor</div>
            </div>
          </ModalHeader>

          <ModalBody>
            <div className="mb-3">
              <label className={labelClass}>Full name *</label>
              <input
                className={inputClass}
                value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                placeholder="e.g. Ooi Kim Seng"
                autoFocus
              />
            </div>

            <div className="mb-3">
              <label className={labelClass}>Initials *</label>
              <input
                className={inputClass}
                value={form.initials}
                onChange={e => setForm(f => ({ ...f, initials: e.target.value.toUpperCase().slice(0, 3) }))}
                placeholder="OKS"
                maxLength={3}
              />
              <div className="text-[10px] text-text-3 mt-0.5">2–3 uppercase letters</div>
            </div>

            <div className="mb-1">
              <label className={labelClass}>Avatar color</label>
              <div className="flex items-center gap-2">
                {AVATAR_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, avatarColor: color }))}
                    className={`w-5 h-5 rounded-full transition-all ${COLOR_BG[color]} ${
                      form.avatarColor === color
                        ? 'ring-2 ring-offset-1 ring-info-border'
                        : 'hover:scale-110'
                    }`}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {addError && (
              <div className="mt-3 text-xs text-danger-text bg-danger-bg border border-danger-border rounded-md px-3 py-2">{addError}</div>
            )}
          </ModalBody>

          <ModalFooter>
            <Button onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAdd} disabled={addMutation.isPending}>
              {addMutation.isPending ? 'Adding…' : 'Add requestor'}
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </div>
  )
}
