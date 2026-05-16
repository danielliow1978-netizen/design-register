import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth'
import { ThemeToggle } from './ThemeToggle'
import { Avatar } from '../ui/Pill'

const TABS = [
  { path: '/register',    label: '📋 Register' },
  { path: '/productivity', label: '📊 Productivity' },
  { path: '/audit',       label: '📜 Audit log' },
  { path: '/recycle',     label: '🗑 Recycle bin' },
]

export function TopBar() {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const navigate = useNavigate()

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    logout()
    navigate('/login')
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-surface-2 rounded-md mb-4 border border-border">
      <div className="flex items-center gap-6">
        <div className="font-medium text-sm flex items-center gap-2">
          <span>📐</span> Design Register
        </div>
        <nav className="flex gap-1">
          {TABS.map(tab => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `text-[13px] px-3 py-1.5 rounded-md transition-colors ${
                  isActive
                    ? 'bg-surface text-info-text font-medium border border-border'
                    : 'text-text-2 hover:text-text'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {user && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-text-2 hover:text-text"
            title="Click to log out"
          >
            <Avatar initials={user.initials} color={user.avatarColor} size="md" />
            <span>{user.fullName}</span>
          </button>
        )}
      </div>
    </div>
  )
}
