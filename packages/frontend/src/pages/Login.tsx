import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore(s => s.login)
  const navigate = useNavigate()
  const theme = useThemeStore(s => s.theme)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, user } = await authApi.login(email, password)
      login(token, user)
      navigate('/register')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-3xl mb-2">📐</div>
          <h1 className="text-xl font-medium text-text">Design Register</h1>
          <p className="text-sm text-text-2 mt-1">M&E drawing productivity tracker</p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
          <h2 className="text-base font-medium text-text mb-4">Sign in</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] text-text-2 mb-1.5 font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-md text-text placeholder-text-3 focus:outline-none focus:border-info-border transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] text-text-2 mb-1.5 font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-md text-text placeholder-text-3 focus:outline-none focus:border-info-border transition-colors"
              />
            </div>

            {error && (
              <div className="text-[12px] text-danger-text bg-danger-bg border border-danger-border rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 text-sm font-medium bg-info-bg text-info-text border border-info-border rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>


        {/* Theme toggle in footer */}
        <div className="flex justify-center mt-4">
          <button
            onClick={() => useThemeStore.getState().setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light')}
            className="text-xs text-text-3 hover:text-text-2 transition-colors"
          >
            {theme === 'light' ? '☀️ Light' : theme === 'dark' ? '🌙 Dark' : '💻 Auto'} theme
          </button>
        </div>
      </div>
    </div>
  )
}
