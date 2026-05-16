import { useEffect } from 'react'
import { useThemeStore } from '../store/themeStore'
import { useAuthStore } from '../store/authStore'
import { usersApi } from '../api/users'
import type { ThemeMode } from '../types'

export function useTheme() {
  const { theme, setTheme } = useThemeStore()
  const user = useAuthStore(s => s.user)
  const updateUser = useAuthStore(s => s.updateUser)

  // Apply dark class to <html>
  useEffect(() => {
    const html = document.documentElement
    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      html.classList.toggle('dark', mq.matches)
      const h = (e: MediaQueryListEvent) => html.classList.toggle('dark', e.matches)
      mq.addEventListener('change', h)
      return () => mq.removeEventListener('change', h)
    } else {
      html.classList.toggle('dark', theme === 'dark')
    }
  }, [theme])

  const cycleTheme = async () => {
    const next: ThemeMode = theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light'
    setTheme(next)
    if (user) {
      try {
        await usersApi.patchPreferences(user.id, { theme: next })
        updateUser({ theme: next })
      } catch { /* ignore */ }
    }
  }

  return { theme, cycleTheme }
}
