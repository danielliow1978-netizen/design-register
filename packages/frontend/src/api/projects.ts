import { apiClient } from './client'
import type { Project } from '../types'

export const projectsApi = {
  list: () =>
    apiClient.get<{ projects: Project[] }>('/projects').then(r => r.data.projects),
  get: (id: string) =>
    apiClient.get<{ project: Project; stats: Record<string, number | null> }>(`/projects/${id}`).then(r => r.data),
  create: (data: Partial<Project>) =>
    apiClient.post<{ project: Project }>('/projects', data).then(r => r.data.project),
}
