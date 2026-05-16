import { useTheme } from '../../hooks/useTheme'
import type { ThemeMode } from '../../types'

const THEME_ICONS: Record<ThemeMode, string> = { light: '☀️', dark: '🌙', auto: '💻' }
const THEME_LABELS: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', auto: 'Auto' }

export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme()
  return (
    <button
      onClick={cycleTheme}
      title={`Theme: ${THEME_LABELS[theme]} (click to cycle)`}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-text-2 hover:bg-surface border border-border transition-colors"
    >
      <span>{THEME_ICONS[theme]}</span>
      <span>{THEME_LABELS[theme]}</span>
    </button>
  )
}
