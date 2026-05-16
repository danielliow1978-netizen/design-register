import { create } from 'zustand'
import type { User } from '../types'

interface AuthState {
  token: string | null
  user: User | null
  login: (token: string, user: User) => void
  logout: () => void
  updateUser: (updates: Partial<User>) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('dr_token'),
  user: (() => {
    try {
      const raw = localStorage.getItem('dr_user')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })(),

  login: (token, user) => {
    localStorage.setItem('dr_token', token)
    localStorage.setItem('dr_user', JSON.stringify(user))
    set({ token, user })
  },

  logout: () => {
    localStorage.removeItem('dr_token')
    localStorage.removeItem('dr_user')
    set({ token: null, user: null })
  },

  updateUser: (updates) => set(state => {
    if (!state.user) return state
    const updated = { ...state.user, ...updates }
    localStorage.setItem('dr_user', JSON.stringify(updated))
    return { user: updated }
  }),
}))
