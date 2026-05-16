import { apiClient } from './client'
import type { AuditEntry } from '../types'

export const auditApi = {
  list: (params?: { userId?: string; action?: string; drawingId?: string; from?: string; to?: string; limit?: number; offset?: number }) =>
    apiClient.get<{ entries: AuditEntry[]; total: number }>('/audit', { params }).then(r => r.data),
}
