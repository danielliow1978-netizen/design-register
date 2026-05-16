import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { projectsApi } from '../api/projects'
import type { Project } from '../types'

interface ManageProjectsModalProps {
  open: boolean
  onClose: () => void
}

export function ManageProjectsModal({ open, onClose }: ManageProjectsModalProps) {
  const queryClient = useQueryClient()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setConfirmId(null)
      setError('')
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { error?: string } } }
      setError(apiErr.response?.data?.error || 'Failed to delete project')
      setConfirmId(null)
    },
  })

  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-lg">
      <ModalHeader onClose={onClose}>
        <div className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center text-lg">🗂</div>
        <div>
          <div className="font-medium text-base">Manage Projects</div>
          <div className="text-xs text-text-2">Projects with drawings cannot be deleted</div>
        </div>
      </ModalHeader>

      <ModalBody>
        {error && (
          <div className="mb-3 text-xs text-danger-text bg-danger-bg border border-danger-border rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="text-xs text-text-3 py-4 text-center">Loading…</div>
        )}

        {!isLoading && projects.length === 0 && (
          <div className="text-xs text-text-3 py-4 text-center">No projects yet</div>
        )}

        {!isLoading && projects.length > 0 && (
          <ul className="space-y-1">
            {projects.map((project: Project) => {
              const drawingCount = project._count?.drawings ?? 0
              const hasDrawings = drawingCount > 0
              const isConfirming = confirmId === project.id

              return (
                <li
                  key={project.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface-2 border border-border"
                >
                  {/* Icon */}
                  <span className="text-base shrink-0">
                    {project.iconEmoji || '📁'}
                  </span>

                  {/* Project info */}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-text truncate">
                      {project.code} — {project.name}
                    </span>
                    {hasDrawings && (
                      <span className="ml-2 text-[11px] text-text-3 bg-surface border border-border rounded px-1.5 py-0.5">
                        {drawingCount} drawing{drawingCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  {isConfirming ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] text-text-2 mr-1">Confirm delete?</span>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(project.id)}
                        disabled={deleteMutation.isPending}
                        className="px-2 py-1 text-[11px] text-danger-text bg-danger-bg border border-danger-border rounded hover:opacity-80 transition-opacity disabled:opacity-50"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="px-2 py-1 text-[11px] text-text-2 bg-surface border border-border rounded hover:opacity-80 transition-opacity"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!hasDrawings) {
                          setError('')
                          setConfirmId(project.id)
                        }
                      }}
                      disabled={hasDrawings}
                      title={hasDrawings ? 'Has drawings' : 'Delete project'}
                      className={`shrink-0 px-2 py-1.5 text-xs rounded-md border transition-opacity ${
                        hasDrawings
                          ? 'text-text-3 bg-surface border-border opacity-40 cursor-not-allowed'
                          : 'text-danger-text bg-danger-bg border-danger-border hover:opacity-80 cursor-pointer'
                      }`}
                    >
                      🗑
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose}>Close</Button>
      </ModalFooter>
    </Modal>
  )
}
