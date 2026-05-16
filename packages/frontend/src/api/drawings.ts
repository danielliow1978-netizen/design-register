import { apiClient } from './client'
import type { Drawing, LateReason } from '../types'

export interface DrawingsQuery {
  designerId?: string
  projectId?: string
  status?: string
  search?: string
  sort?: string
}

export const drawingsApi = {
  list: (params?: DrawingsQuery) =>
    apiClient.get<{ drawings: Drawing[] }>('/drawings', { params }).then(r => r.data.drawings),
  get: (id: string) =>
    apiClient.get<{ drawing: Drawing }>(`/drawings/${id}`).then(r => r.data.drawing),
  create: (data: Omit<Drawing, 'id' | 'project' | 'designer' | 'requestor' | 'status' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'duration' | 'delay'>) =>
    apiClient.post<{ drawing: Drawing }>('/drawings', data).then(r => r.data.drawing),
  patch: (id: string, data: Partial<Pick<Drawing, 'drawingTitle' | 'discipline' | 'category' | 'designerId' | 'requestorId' | 'notes'>>) =>
    apiClient.patch<{ drawing: Drawing }>(`/drawings/${id}`, data).then(r => r.data.drawing),
  complete: (id: string, payload?: { lateReason?: LateReason; lateReasonDetail?: string }) =>
    apiClient.post<{ drawing: Drawing }>(`/drawings/${id}/complete`, payload || {}).then(r => r.data.drawing),
  softDelete: (id: string, password: string, reason: string) =>
    apiClient.delete<{ message: string }>(`/drawings/${id}`, { data: { password, reason } }).then(r => r.data),
}
