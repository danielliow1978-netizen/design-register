import { apiClient } from './client'
import type { User, ThemeMode, PdfFormat } from '../types'

export const usersApi = {
  list: () =>
    apiClient.get<{ users: User[] }>('/users').then(r => r.data.users),
  patchPreferences: (id: string, prefs: { theme?: ThemeMode; pdfDefault?: PdfFormat; emailDigestEnabled?: boolean }) =>
    apiClient.patch<{ user: Partial<User> }>(`/users/${id}/preferences`, prefs).then(r => r.data.user),
}
