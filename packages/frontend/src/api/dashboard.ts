import { apiClient } from './client'
import type { DashboardData } from '../types'

export const dashboardApi = {
  team: (params?: { designerId?: string; from?: string; to?: string }) =>
    apiClient.get<DashboardData>('/dashboard/team', { params }).then(r => r.data),
}
