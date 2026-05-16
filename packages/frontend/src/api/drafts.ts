import { apiClient } from './client'
import type { DrawingDraft } from '../types'

export const draftsApi = {
  list: () =>
    apiClient.get<{ drafts: DrawingDraft[] }>('/drafts').then(r => r.data.drafts),
  upsert: (id: string | undefined, formData: Record<string, unknown>, completionPct: number) =>
    apiClient.post<{ draft: DrawingDraft }>('/drafts', { id, formData, completionPct }).then(r => r.data.draft),
  get: (id: string) =>
    apiClient.get<{ draft: DrawingDraft }>(`/drafts/${id}`).then(r => r.data.draft),
  remove: (id: string) =>
    apiClient.delete(`/drafts/${id}`).then(r => r.data),
}
