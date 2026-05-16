import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { usersApi } from '../api/users'
import type { Role, AvatarColor } from '../types'

interface AddUserModalProps {
  open: boolean
  onClose: () => void
}

const ROLES: Role[] = ['DESIGNER', 'SENIOR_DESIGNER', 'DESIGN_MANAGER', 'PROJECT_MANAGER', 'DEPARTMENT_HEAD', 'ADMIN']
const DISCIPLINES = ['MECHANICAL', 'ELECTRICAL', 'ELV', 'FIRE_PROTECTION', 'PLUMBING']
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
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

interface FormData {
  fullName: string
  email: string
  initials: string
  role: Role
  discipline: string
  avatarColor: AvatarColor
  password: string
}

const INITIAL: FormData = {
  fullName: '',
  email: '',
  initials: '',
  role: 'DESIGNER',
  discipline: '',
  avatarColor: 'info',
  password: '',
}

export function AddUserModal({ open, onClose }: AddUserModalProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<FormData>(INITIAL)
  const [error, setError] = useState('')
  const [createdPassword, setCreatedPassword] = useState('')
  const [copied, setCopied] = useState(false)

  const createMutation = useMutation({
    mutationFn: () =>
      usersApi.create({
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        initials: formData.initials.trim().toUpperCase(),
        role: formData.role,
        discipline: formData.discipline || undefined,
        avatarColor: formData.avatarColor,
        password: formData.password,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setCreatedPassword(formData.password)
      setError('')
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { error?: string } } }
      setError(apiErr.response?.data?.error || 'Failed to create user')
    },
  })

  const handleSubmit = () => {
    setError('')
    if (!formData.fullName.trim()) { setError('Full name is required'); return }
    if (!formData.email.trim()) { setError('Email is required'); return }
    if (!formData.initials.trim()) { setError('Initials are required'); return }
    if (!formData.password || formData.password.length < 8) { setError('Password must be at least 8 characters'); return }
    createMutation.mutate()
  }

  const handleDone = () => {
    setFormData(INITIAL)
    setError('')
    setCreatedPassword('')
    setCopied(false)
    onClose()
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(createdPassword).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const update = <K extends keyof FormData>(field: K, value: FormData[K]) =>
    setFormData(f => ({ ...f, [field]: value }))

  const inputClass = "w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-md text-text focus:outline-none focus:border-info-border transition-colors"
  const labelClass = "block text-[10px] text-text-2 mb-1 font-medium uppercase tracking-wide"
  const selectClass = inputClass + " cursor-pointer"

  if (!open) return null

  // Success state
  if (createdPassword) {
    return (
      <Modal open={open} onClose={handleDone} maxWidth="max-w-md">
        <ModalHeader onClose={handleDone}>
          <div>
            <div className="font-medium text-base">Account created!</div>
            <div className="text-xs text-text-2">Share the temporary password with the new team member</div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <div className="font-semibold text-sm mb-1">Account created successfully</div>
            <div className="text-xs text-text-2 mb-4">
              The user should change their password after first login.
            </div>
            <div className="mb-2">
              <label className={labelClass}>Temporary password</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 text-xs font-mono bg-surface-2 border border-border rounded-md text-text select-all">
                  {createdPassword}
                </code>
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 text-xs border border-border rounded-md hover:bg-surface-2 transition-colors"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleDone}>Done</Button>
        </ModalFooter>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-lg">
      <ModalHeader onClose={onClose}>
        <div className="w-9 h-9 rounded-full bg-info-bg text-info-text flex items-center justify-center text-lg">
          👤
        </div>
        <div>
          <div className="font-medium text-base">Add team member</div>
          <div className="text-xs text-text-2">Create a new account for your team</div>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="col-span-2">
            <label className={labelClass}>Full name *</label>
            <input
              className={inputClass}
              value={formData.fullName}
              onChange={e => update('fullName', e.target.value)}
              placeholder="e.g. Jane Smith"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className={labelClass}>Email *</label>
          <input
            type="email"
            className={inputClass}
            value={formData.email}
            onChange={e => update('email', e.target.value)}
            placeholder="jane.smith@example.com"
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
          <select
            className={selectClass}
            value={formData.discipline}
            onChange={e => update('discipline', e.target.value)}
          >
            <option value="">None</option>
            {DISCIPLINES.map(d => (
              <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
            ))}
          </select>
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

        <div className="mb-1">
          <label className={labelClass}>Temporary password *</label>
          <input
            type="text"
            className={inputClass}
            value={formData.password}
            onChange={e => update('password', e.target.value)}
            placeholder="Min. 8 characters"
          />
          <div className="text-[10px] text-text-3 mt-0.5">User should change this after first login</div>
        </div>

        {error && (
          <div className="mt-3 text-xs text-danger-text bg-danger-bg border border-danger-border rounded-md px-3 py-2">{error}</div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creating…' : 'Add member'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
