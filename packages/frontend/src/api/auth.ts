import { apiClient } from './client'
import type { User } from '../types'

export interface LoginResponse { token: string; user: User }

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>('/auth/login', { email, password }).then(r => r.data),
  logout: () =>
    apiClient.post('/auth/logout').then(r => r.data),
  me: () =>
    apiClient.get<{ user: User }>('/auth/me').then(r => r.data.user),
}
