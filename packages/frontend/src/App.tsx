import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useThemeStore } from './store/themeStore'
import { useAuthStore } from './store/authStore'
import Login from './pages/Login'
import RegisterPage from './pages/RegisterPage'
import ProductivityPage from './pages/ProductivityPage'
import AuditLogPage from './pages/AuditLogPage'
import RecycleBinPage from './pages/RecycleBinPage'
import UsersPage from './pages/UsersPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <ProtectedRoute><Navigate to="/register" replace /></ProtectedRoute>,
  },
  {
    path: '/register',
    element: <ProtectedRoute><RegisterPage /></ProtectedRoute>,
  },
  {
    path: '/productivity',
    element: <ProtectedRoute><ProductivityPage /></ProtectedRoute>,
  },
  {
    path: '/audit',
    element: <ProtectedRoute><AuditLogPage /></ProtectedRoute>,
  },
  {
    path: '/recycle',
    element: <ProtectedRoute><RecycleBinPage /></ProtectedRoute>,
  },
  {
    path: '/users',
    element: <ProtectedRoute><UsersPage /></ProtectedRoute>,
  },
  { path: '*', element: <Navigate to="/register" replace /> },
])

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore(s => s.theme)

  useEffect(() => {
    const html = document.documentElement
    function applyTheme(dark: boolean) {
      html.classList.toggle('dark', dark)
    }
    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applyTheme(mq.matches)
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    } else {
      applyTheme(theme === 'dark')
    }
  }, [theme])

  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
