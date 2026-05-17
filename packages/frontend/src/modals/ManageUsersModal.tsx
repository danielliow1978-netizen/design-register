import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Pill'
import { usersApi } from '../api/users'
import { useAuthStore } from '../store/authStore'

interface ManageUsersModalProps {
  open: boolean
  onClose: () => void
}

export function ManageUsersModal({ open, onClose }: ManageUsersModalProps) {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore(s => s.user)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const isAdmin = currentUser?.role === 'ADMIN'

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: open,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setConfirmId(null)
      setErrorMsg('')
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { error?: string } } }
      setErrorMsg(apiErr.response?.data?.error || 'Failed to delete user')
      setConfirmId(null)
    },
  })

  const handleClose = () => {
    setConfirmId(null)
    setErrorMsg('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="max-w-md">
      <ModalHeader onClose={handleClose}>
        <div className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center text-lg">👥</div>
        <div>
          <div className="font-medium text-base">Manage Team Members</div>
        </div>
      </ModalHeader>

      <ModalBody>
        {errorMsg && (
          <div className="mb-3 text-xs text-danger-text bg-danger-bg border border-danger-border rounded-md px-3 py-2">
            {errorMsg}
          </div>
        )}

        {users.length === 0 ? (
          <div className="py-8 text-center text-text-3 text-sm">No team members</div>
        ) : (
          <div className="divide-y divide-border">
            {users.map(user => {
              const isSelf = user.id === currentUser?.id
              const isConfirming = confirmId === user.id
              const isRequestorAccount = user.email.endsWith('@requestor.local')
              // Only show delete for: requestor accounts (any user) or real accounts (ADMIN only)
              const canDelete = !isSelf && (isRequestorAccount || isAdmin)

              return (
                <div key={user.id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar initials={user.initials} color={user.avatarColor} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-text truncate">{user.fullName}</div>
                      {/* Show email only for requestor placeholder accounts so users know it's auto-generated */}
                      {isRequestorAccount && (
                        <div className="text-[10px] text-text-3 italic truncate">Requestor account</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-text-2 bg-surface-2 border border-border rounded px-1.5 py-0.5 whitespace-nowrap">
                      {user.role.replace(/_/g, ' ')}
                    </span>

                    {canDelete && (isConfirming ? (
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="text-text-2">Confirm?</span>
                        <button
                          onClick={() => deleteMutation.mutate(user.id)}
                          disabled={deleteMutation.isPending}
                          className="px-1.5 py-0.5 bg-danger-bg text-danger-text border border-danger-border rounded hover:opacity-80 transition-opacity"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="px-1.5 py-0.5 bg-surface-2 text-text-2 border border-border rounded hover:opacity-80 transition-opacity"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setErrorMsg(''); setConfirmId(user.id) }}
                        title="Delete"
                        className="w-6 h-6 flex items-center justify-center rounded text-xs text-text-2 hover:bg-danger-bg hover:text-danger-text transition-colors"
                      >
                        🗑
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button onClick={handleClose}>Close</Button>
      </ModalFooter>
    </Modal>
  )
}
