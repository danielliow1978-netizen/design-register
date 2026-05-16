import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TopBar } from '../components/layout/TopBar'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Pill'
import { AddUserModal } from '../modals/AddUserModal'
import { EditUserModal } from '../modals/EditUserModal'
import { usersApi } from '../api/users'
import { useAuthStore } from '../store/authStore'
import type { User } from '../types'

type UserWithCount = User & { _count?: { drawingsAsDesigner: number } }

const ROLE_LEVELS = ['DESIGNER', 'SENIOR_DESIGNER', 'DESIGN_MANAGER', 'PROJECT_MANAGER', 'DEPARTMENT_HEAD', 'ADMIN']

function formatRole(role: string): string {
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore(s => s.user)
  const isManager = currentUser ? ROLE_LEVELS.indexOf(currentUser.role) >= 2 : false
  const isAdmin = currentUser?.role === 'ADMIN'

  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)

  const { data: users = [], isLoading } = useQuery<UserWithCount[]>({
    queryKey: ['users'],
    queryFn: usersApi.list as () => Promise<UserWithCount[]>,
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      usersApi.update(id, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  return (
    <div className="min-h-screen bg-bg p-4">
      <TopBar />

      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-base font-semibold text-text">👥 Team</h1>
            <p className="text-xs text-text-2 mt-0.5">{users.length} member{users.length !== 1 ? 's' : ''}</p>
          </div>
          {isManager && (
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              + Add member
            </Button>
          )}
        </div>

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-text-2">Loading team members…</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-2">No team members found.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-left px-4 py-2.5 text-[10px] text-text-2 font-medium uppercase tracking-wide">Member</th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-text-2 font-medium uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-text-2 font-medium uppercase tracking-wide">Discipline</th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-text-2 font-medium uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-text-2 font-medium uppercase tracking-wide">Drawings</th>
                  {(isManager || isAdmin) && (
                    <th className="text-right px-4 py-2.5 text-[10px] text-text-2 font-medium uppercase tracking-wide">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={user.initials} color={user.avatarColor} size="md" />
                        <div>
                          <div className="font-medium text-text">{user.fullName}</div>
                          <div className="text-[10px] text-text-2">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text">{formatRole(user.role)}</td>
                    <td className="px-4 py-3 text-text-2">
                      {user.discipline ? user.discipline.replace(/_/g, ' ') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {user.active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-success-bg text-success-text border border-success-border">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-2 text-text-2 border border-border">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-2">
                      {user._count?.drawingsAsDesigner ?? '—'}
                    </td>
                    {(isManager || isAdmin) && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {isManager && (
                            <Button size="sm" onClick={() => setEditUser(user)}>
                              Edit
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant={user.active ? 'danger' : 'success'}
                              onClick={() => toggleActiveMutation.mutate({ id: user.id, active: !user.active })}
                              disabled={toggleActiveMutation.isPending}
                            >
                              {user.active ? 'Deactivate' : 'Reactivate'}
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditUserModal open={!!editUser} onClose={() => setEditUser(null)} user={editUser} />
    </div>
  )
}
