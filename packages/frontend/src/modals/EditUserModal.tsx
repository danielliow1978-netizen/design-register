import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Pill'
import { usersApi } from '../api/users'
import { useAuthStore } from '../store/authStore'
import { DISCIPLINES, DISCIPLINE_LABELS } from '../lib/disciplines'
import type { User, Role, AvatarColor } from '../types'

interface EditUserModalProps {
  open: boolean
  onClose: () => void
  user: User | null
}

const ROLES: Role[] = ['DRAFTER', 'SENIOR_DRAFTER', 'DESIGNER', 'SENIOR_DESIGNER', 'PROJECT_ENGINEER', 'QS_DEPARTMENT', 'ASSISTANT_DESIGN_MANAGER', 'DESIGN_MANAGER', 'PROJECT_MANAGER', 'DEPARTMENT_HEAD', 'COO', 'CEO', 'ADMIN']

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

function formatRole(role: string): string {
  return ROLE_LABELS[role] ?? role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

interface FormData {
  fullName: string
  initials: string
  role: Role
  discipline: string
  avatarColor: AvatarColor
  active: boolean
}

export function EditUserModal({ open, onClose, user }: EditUserModalProps) {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore(s => s.user)
  const isAdmin = currentUser?.role === 'ADMIN'

  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    initials: '',
    role: 'DESIGNER',
    discipline: '',
    avatarColor: 'info',
    active: true,
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName,
        initials: user.initials,
        role: user.role,
        discipline: user.discipline ?? '',
        avatarColor: user.avatarColor,
        active: user.active,
      })
      setError('')
    }
  }, [user])

  const updateMutation = useMutation({
    mutationFn: () =>
      usersApi.update(user!.id, {
        fullName: formData.fullName.trim(),
        initials: formData.initials.trim().toUpperCase(),
        role: formData.role,
        discipline: formData.discipline || null,
        avatarColor: formData.avatarColor,
        ...(isAdmin ? { active: formData.active } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setError('')
      onClose()
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { error?: string } } }
      setError(apiErr.response?.data?.error || 'Failed to update user')
    },
  })

  const handleSubmit = () => {
    setError('')
    if (!formData.fullName.trim()) { setError('Full name is required'); return }
    if (!formData.initials.trim()) { setError('Initials are required'); return }
    updateMutation.mutate()
  }

  const update = <K extends keyof FormData>(field: K, value: FormData[K]) =>
    setFormData(f => ({ ...f, [field]: value }))

  const inputClass = "w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-md text-text focus:outline-none focus:border-info-border transition-colors"
  const labelClass = "block text-[10px] text-text-2 mb-1 font-medium uppercase tracking-wide"
  const selectClass = inputClass + " cursor-pointer"

  if (!open || !user) return null

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-lg">
      <ModalHeader onClose={onClose}>
        <Avatar initials={formData.initials || user.initials} color={formData.avatarColor} size="md" />
        <div>
          <div className="font-medium text-base">Edit team member</div>
          <div className="text-xs text-text-2">{user.email}</div>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="mb-3">
          <label className={labelClass}>Full name *</label>
          <input
            className={inputClass}
            value={formData.fullName}
            onChange={e => update('fullName', e.target.value)}
            placeholder="e.g. Jane Smith"
          />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className={labelClass}>Initials *</label>
            <input
              className={inputClass}
              value={formData.initials}
              onChange={e => update('initials', e.target.value.toUpperCase().slice(0, 3))}
              placeholder="JS"
              maxLength={3}
            />
            <div className="text-[10px] text-text-3 mt-0.5">2-3 uppercase letters</div>
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Role *</label>
            <select
              className={selectClass}
              value={formData.role}
              onChange={e => update('role', e.target.value as Role)}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{formatRole(r)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className={labelClass}>Discipline</label>
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
                  <option value="">None</option>
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

        <div className="mb-3">
          <label className={labelClass}>Avatar color</label>
          <div className="flex items-center gap-2">
            {AVATAR_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => update('avatarColor', color)}
                className={`w-5 h-5 rounded-full transition-all ${COLOR_BG[color]} ${
                  formData.avatarColor === color
                    ? 'ring-2 ring-offset-1 ring-info-border'
                    : 'hover:scale-110'
                }`}
                title={color}
              />
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="mb-1">
            <label className={labelClass}>Account status</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={e => update('active', e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-xs text-text">Active</span>
              <span className="text-[10px] text-text-3">(uncheck to deactivate this user)</span>
            </label>
          </div>
        )}

        {error && (
          <div className="mt-3 text-xs text-danger-text bg-danger-bg border border-danger-border rounded-md px-3 py-2">{error}</div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
