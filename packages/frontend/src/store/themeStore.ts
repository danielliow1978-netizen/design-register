import { create } from 'zustand'
import type { ThemeMode } from '../types'

interface ThemeState {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem('dr_theme') as ThemeMode) || 'auto',
  setTheme: (theme) => {
    localStorage.setItem('dr_theme', theme)
    set({ theme })
  },
}))
