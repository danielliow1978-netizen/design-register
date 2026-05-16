import { apiClient } from './client'
import type { User, ThemeMode, PdfFormat, Role } from '../types'

export const usersApi = {
  list: () =>
    apiClient.get<{ users: User[] }>('/users').then(r => r.data.users),
  patchPreferences: (id: string, prefs: { theme?: ThemeMode; pdfDefault?: PdfFormat; emailDigestEnabled?: boolean }) =>
    apiClient.patch<{ user: Partial<User> }>(`/users/${id}/preferences`, prefs).then(r => r.data.user),
  create: (data: {
    fullName: string
    email: string
    initials: string
    role: Role
    discipline?: string
    avatarColor?: string
    password: string
  }) =>
    apiClient.post<{ user: User }>('/users', data).then(r => r.data.user),
  update: (id: string, data: {
    fullName?: string
    initials?: string
    role?: Role
    discipline?: string | null
    avatarColor?: string
    active?: boolean
  }) =>
    apiClient.patch<{ user: User }>(`/users/${id}`, data).then(r => r.data.user),
  delete: (id: string) =>
    apiClient.delete(`/users/${id}`).then(r => r.data),
}
