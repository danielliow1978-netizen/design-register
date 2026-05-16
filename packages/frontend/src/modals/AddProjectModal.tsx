import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { projectsApi } from '../api/projects'
import { usersApi } from '../api/users'

interface AddProjectModalProps {
  open: boolean
  onClose: () => void
  onCreated?: (projectId: string) => void
  /** Compact mode: only asks for project name, auto-generates code */
  compact?: boolean
}

const EMOJI_SUGGESTIONS = ['🏭', '💾', '📑', '🏗', '🏢', '🔌', '💧', '🔥', '🛠', '📐', '🌐', '⚡']
const CONTRACT_TYPES = ['EPC', 'EPCM'] as const
const PROJECT_STATUSES = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const

interface ProjectFormData {
  code: string
  name: string
  client: string
  contractType: string
  status: string
  projectManagerId: string
  iconEmoji: string
  startDate: string
  endDate: string
}

const INITIAL: ProjectFormData = {
  code: '',
  name: '',
  client: '',
  contractType: '',
  status: 'ACTIVE',
  projectManagerId: '',
  iconEmoji: '🏗',
  startDate: '',
  endDate: '',
}

/** Generate a project code from a name, e.g. "Marina Bay Tower" → "MBT" */
function autoCode(name: string, existingCodes: string[]): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 6)
  if (!initials) return ''
  // Avoid clashes
  let candidate = initials
  let n = 2
  while (existingCodes.includes(candidate)) {
    candidate = `${initials}${n++}`
  }
  return candidate
}

export function AddProjectModal({ open, onClose, onCreated, compact = false }: AddProjectModalProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<ProjectFormData>(INITIAL)
  const [error, setError] = useState('')

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list, enabled: compact })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: !compact })
  const managers = users.filter(u =>
    ['PROJECT_MANAGER', 'DESIGN_MANAGER', 'DEPARTMENT_HEAD', 'ADMIN'].includes(u.role)
  )

  const createMutation = useMutation({
    mutationFn: () => {
      const code = compact
        ? autoCode(formData.name, projects.map(p => p.code))
        : formData.code
      return projectsApi.create({
        code,
        name: formData.name,
        client: formData.client || undefined,
        contractType: formData.contractType as 'EPC' | 'EPCM' | undefined || undefined,
        status: formData.status as 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' || undefined,
        projectManagerId: formData.projectManagerId || undefined,
        iconEmoji: formData.iconEmoji || undefined,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
      } as any)
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setFormData(INITIAL)
      setError('')
      onCreated?.(project.id)
      onClose()
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { error?: string } } }
      setError(apiErr.response?.data?.error || 'Failed to create project')
    },
  })

  const handleSubmit = () => {
    setError('')
    if (!formData.name.trim()) { setError('Project name is required'); return }
    if (!compact && !formData.code.trim()) { setError('Project code is required'); return }
    createMutation.mutate()
  }

  const update = (field: keyof ProjectFormData, value: string) =>
    setFormData(f => ({ ...f, [field]: value }))

  const inputClass = "w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-md text-text focus:outline-none focus:border-info-border transition-colors"
  const labelClass = "block text-[10px] text-text-2 mb-1 font-medium uppercase tracking-wide"
  const selectClass = inputClass + " cursor-pointer"

  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} maxWidth={compact ? 'max-w-sm' : 'max-w-lg'}>
      <ModalHeader onClose={onClose}>
        <div className="w-9 h-9 rounded-full bg-info-bg text-info-text flex items-center justify-center text-lg">
          {formData.iconEmoji || '🏗'}
        </div>
        <div>
          <div className="font-medium text-base">Add project</div>
          <div className="text-xs text-text-2">
            {compact ? 'Quick-add a project by name' : 'Create a new project to assign drawings to'}
          </div>
        </div>
      </ModalHeader>

      <ModalBody>
        {compact ? (
          /* ── Compact mode: name only ── */
          <div>
            <label className={labelClass}>Project name *</label>
            <input
              className={inputClass}
              value={formData.name}
              onChange={e => update('name', e.target.value)}
              placeholder="e.g. Marina Bay Tower M&E"
              autoFocus
            />
            <div className="text-[10px] text-text-3 mt-1">
              A short code will be auto-generated from the name.
            </div>
          </div>
        ) : (
          /* ── Full form ── */
          <>
            {/* Emoji picker */}
            <div className="mb-3">
              <label className={labelClass}>Icon</label>
              <div className="flex items-center gap-2">
                <input
                  className={inputClass + " w-16 text-center text-base"}
                  value={formData.iconEmoji}
                  onChange={e => update('iconEmoji', e.target.value)}
                  maxLength={2}
                  placeholder="🏗"
                />
                <div className="flex gap-1 flex-wrap">
                  {EMOJI_SUGGESTIONS.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => update('iconEmoji', e)}
                      className={`w-7 h-7 rounded border text-sm transition-colors ${
                        formData.iconEmoji === e
                          ? 'border-info-border bg-info-bg'
                          : 'border-border hover:border-border-strong'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className={labelClass}>Code *</label>
                <input
                  className={inputClass}
                  value={formData.code}
                  onChange={e => update('code', e.target.value.toUpperCase())}
                  placeholder="PRJ-104"
                  maxLength={20}
                />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Project name *</label>
                <input
                  className={inputClass}
                  value={formData.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="e.g. Marina Bay Tower M&E"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className={labelClass}>Client</label>
              <input
                className={inputClass}
                value={formData.client}
                onChange={e => update('client', e.target.value)}
                placeholder="e.g. City Developments Ltd"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className={labelClass}>Contract type</label>
                <select className={selectClass} value={formData.contractType} onChange={e => update('contractType', e.target.value)}>
                  <option value="">—</option>
                  {CONTRACT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select className={selectClass} value={formData.status} onChange={e => update('status', e.target.value)}>
                  {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Project manager</label>
                <select className={selectClass} value={formData.projectManagerId} onChange={e => update('projectManagerId', e.target.value)}>
                  <option value="">—</option>
                  {managers.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Start date</label>
                <input type="date" className={inputClass} value={formData.startDate} onChange={e => update('startDate', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>End date</label>
                <input type="date" className={inputClass} value={formData.endDate} onChange={e => update('endDate', e.target.value)} />
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="mt-3 text-xs text-danger-text bg-danger-bg border border-danger-border rounded-md px-3 py-2">{error}</div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creating…' : 'Create project'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
