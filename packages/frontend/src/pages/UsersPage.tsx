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

type SortField = 'fullName' | 'role' | 'discipline' | 'status' | 'drawings'
type SortDir = 'asc' | 'desc'

const MANAGER_ROLES = ['DESIGN_MANAGER', 'ASSISTANT_DESIGN_MANAGER', 'PROJECT_MANAGER', 'DEPARTMENT_HEAD', 'COO', 'CEO', 'ADMIN']

const ROLE_ORDER: Record<string, number> = {
  DRAFTER: 0, SENIOR_DRAFTER: 1, DESIGNER: 2, SENIOR_DESIGNER: 3,
  PROJECT_ENGINEER: 4, QS_DEPARTMENT: 5, ASSISTANT_DESIGN_MANAGER: 6,
  DESIGN_MANAGER: 7, PROJECT_MANAGER: 8, DEPARTMENT_HEAD: 9,
  COO: 10, CEO: 11, ADMIN: 12,
}

const ROLE_LABELS: Record<string, string> = {
  DRAFTER: 'Drafter',
  SENIOR_DRAFTER: 'Senior Drafter',
  DESIGNER: 'Designer',
  SENIOR_DESIGNER: 'Senior Designer',
  PROJECT_ENGINEER: 'Project Engineer',
  QS_DEPARTMENT: 'QS Department',
  ASSISTANT_DESIGN_MANAGER: 'Assistant Design Manager',
  DESIGN_MANAGER: 'Design Manager',
  PROJECT_MANAGER: 'Project Manager',
  DEPARTMENT_HEAD: 'Department Head',
  COO: 'COO',
  CEO: 'CEO',
  ADMIN: 'Admin',
}

function formatRole(role: string): string {
  return ROLE_LABELS[role] ?? role.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore(s => s.user)
  const isManager = currentUser ? MANAGER_ROLES.includes(currentUser.role) : false
  const isAdmin = currentUser?.role === 'ADMIN'

  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [sortField, setSortField] = useState<SortField>('fullName')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const { data: allUsers = [], isLoading } = useQuery<UserWithCount[]>({
    queryKey: ['users'],
    queryFn: usersApi.list as () => Promise<UserWithCount[]>,
  })

  // Exclude requestor-only accounts — they live in the Requestors tab
  const users = [...allUsers.filter(u => !u.email.endsWith('@requestor.local'))].sort((a, b) => {
    let cmp = 0
    if (sortField === 'fullName') cmp = a.fullName.localeCompare(b.fullName)
    else if (sortField === 'role') cmp = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99)
    else if (sortField === 'discipline') cmp = (a.discipline ?? '').localeCompare(b.discipline ?? '')
    else if (sortField === 'status') cmp = (a.active === b.active ? 0 : a.active ? -1 : 1)
    else if (sortField === 'drawings') cmp = ((a as UserWithCount)._count?.drawingsAsDesigner ?? 0) - ((b as UserWithCount)._count?.drawingsAsDesigner ?? 0)
    return sortDir === 'asc' ? cmp : -cmp
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
                  {([
                    { field: 'fullName' as SortField, label: 'Member' },
                    { field: 'role' as SortField, label: 'Role' },
                    { field: 'discipline' as SortField, label: 'Discipline' },
                    { field: 'status' as SortField, label: 'Status' },
                    { field: 'drawings' as SortField, label: 'Drawings' },
                  ]).map(({ field, label }) => {
                    const isActive = sortField === field
                    return (
                      <th
                        key={field}
                        onClick={() => handleSort(field)}
                        className={`text-left px-4 py-2.5 text-[10px] font-medium uppercase tracking-wide cursor-pointer select-none whitespace-nowrap transition-colors ${
                          isActive ? 'bg-info-bg text-info-text' : 'text-text-2 hover:bg-info-bg hover:text-info-text'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          <span className="inline-flex flex-col" style={{ fontSize: 8, lineHeight: '7px' }}>
                            <span className={isActive && sortDir === 'asc' ? 'text-info-text font-bold' : 'opacity-30'}>▲</span>
                            <span className={isActive && sortDir === 'desc' ? 'text-info-text font-bold' : 'opacity-30'}>▼</span>
                          </span>
                        </span>
                      </th>
                    )
                  })}
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
