import { apiClient } from './client'
import type { Drawing } from '../types'

export const recycleApi = {
  list: () =>
    apiClient.get<{ drawings: Drawing[] }>('/recycle').then(r => r.data.drawings),
  restore: (id: string) =>
    apiClient.post<{ message: string }>(`/recycle/${id}/restore`).then(r => r.data),
  purge: (id: string, password: string) =>
    apiClient.delete<{ message: string }>(`/recycle/${id}/purge`, { data: { password } }).then(r => r.data),
}
