import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { authApi } from '../../api/auth'

const MANAGER_ROLES = ['DESIGN_MANAGER', 'ASSISTANT_DESIGN_MANAGER', 'PROJECT_MANAGER', 'DEPARTMENT_HEAD', 'COO', 'CEO', 'ADMIN']

const NAV_MAIN = [
  {
    path: '/register',
    label: 'Register',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    path: '/productivity',
    label: 'Productivity',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    path: '/audit',
    label: 'Audit Log',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    path: '/recycle',
    label: 'Recycle Bin',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
  },
]

const NAV_ADMIN = [
  {
    path: '/users',
    label: 'Team',
    managerOnly: true,
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    path: '/requestors',
    label: 'Requestors',
    adminOnly: true,
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export function Sidebar() {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const { theme, setTheme } = useThemeStore()
  const navigate = useNavigate()

  const isManager = user ? MANAGER_ROLES.includes(user.role) : false
  const isAdmin = user?.role === 'ADMIN'

  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    logout()
    navigate('/login')
  }

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark')

  const initials = user?.initials ?? '?'
  const fullName = user?.fullName ?? ''
  const role = user?.role?.replace(/_/g, ' ') ?? ''

  return (
    <aside className="sidebar-root flex flex-col" style={{ width: 220, minHeight: '100vh', flexShrink: 0 }}>
      {/* Logo */}
      <div className="px-4 py-5 border-b sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="sidebar-logo-icon flex items-center justify-center rounded-lg" style={{ width: 34, height: 34, flexShrink: 0 }}>
            <svg style={{ width: 16, height: 16, color: '#fff' }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold sidebar-logo-text leading-tight">Design Register</div>
            <div className="sidebar-logo-sub" style={{ fontSize: 10 }}>Lewe Engineering</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        <div className="sidebar-section-label px-2 mb-1.5" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Main</div>
        {NAV_MAIN.map(item => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) =>
            `sidebar-nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-[13px] font-medium transition-all cursor-pointer ${isActive ? 'sidebar-nav-active' : 'sidebar-nav-inactive'}`
          }>
            <span style={{ width: 16, height: 16, flexShrink: 0 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        {(isManager || isAdmin) && (
          <>
            <div className="sidebar-section-label px-2 mb-1.5 mt-4" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Admin</div>
            {NAV_ADMIN.filter(item =>
              (!item.managerOnly || isManager) && (!item.adminOnly || isAdmin)
            ).map(item => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) =>
                `sidebar-nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-[13px] font-medium transition-all cursor-pointer ${isActive ? 'sidebar-nav-active' : 'sidebar-nav-inactive'}`
              }>
                <span style={{ width: 16, height: 16, flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User + controls */}
      <div className="px-2 pb-4 border-t sidebar-border" style={{ paddingTop: 12 }}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="sidebar-nav-inactive sidebar-nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg w-full text-[13px] font-medium transition-all cursor-pointer mb-1"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <svg style={{ width: 16, height: 16, flexShrink: 0, color: '#f59e0b' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
            </svg>
          ) : (
            <svg style={{ width: 16, height: 16, flexShrink: 0 }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
            </svg>
          )}
          {isDark ? 'Light mode' : 'Dark mode'}
        </button>

        {/* User row */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg sidebar-nav-inactive sidebar-nav-item transition-all cursor-pointer"
          title="Click to log out"
        >
          <div
            className="flex items-center justify-center rounded-full text-white font-bold flex-shrink-0"
            style={{ width: 30, height: 30, fontSize: 11, background: user?.avatarColor ?? '#2563eb' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="sidebar-logo-text text-[12px] font-semibold truncate">{fullName}</div>
            <div className="sidebar-logo-sub truncate" style={{ fontSize: 10, textTransform: 'capitalize' }}>{role.toLowerCase()}</div>
          </div>
        </button>
      </div>
    </aside>
  )
}
