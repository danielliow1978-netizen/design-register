import { apiClient } from './client'
import type { SiteLocation } from '../types'

export interface SiteLocationInput {
  date: string
  siteName: string
  siteArea?: string
  timeIn?: string
  timeOut?: string
  note?: string
}

export const siteLocationsApi = {
  list: (params?: { date?: string; userId?: string; from?: string; to?: string }) =>
    apiClient.get<{ entries: SiteLocation[] }>('/site-locations', { params }).then(r => r.data.entries),
  create: (data: SiteLocationInput) =>
    apiClient.post<{ entry: SiteLocation }>('/site-locations', data).then(r => r.data.entry),
  update: (id: string, data: Partial<SiteLocationInput>) =>
    apiClient.patch<{ entry: SiteLocation }>(`/site-locations/${id}`, data).then(r => r.data.entry),
  delete: (id: string) =>
    apiClient.delete(`/site-locations/${id}`).then(r => r.data),
}
