import { useState } from 'react'
import { usePortalAuthStore } from '@/stores/portalAuthStore'
import BrandLogo from '@/components/BrandLogo'

export default function PortalLogin() {
  const login = usePortalAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email.trim(), password)
    setLoading(false)
    if (!result.success) {
      setError(result.error || 'Login failed')
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="card-base p-8">
          <div className="flex items-center justify-center mb-6">
            <BrandLogo size="lg" showWordmark={false} />
          </div>
          <div className="text-center mb-6">
            <BrandLogo size="sm" className="justify-center mb-1" markClassName="hidden" />
            <p className="text-text-muted text-xs font-mono">Customer Portal</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-text-muted text-xs font-mono uppercase mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                placeholder="your@email.com"
                autoFocus
                required
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-text-muted text-xs font-mono uppercase mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder="Enter your password"
                required
                className={`input-field text-sm ${error ? 'border-red-500' : ''}`}
              />
              {error && (
                <p className="text-red-400 text-xs font-mono mt-1.5">{error}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent-amber text-bg-primary font-mono text-sm font-bold py-2.5 rounded-lg hover:bg-accent-amber/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </div>
        <p className="text-center text-text-muted text-[10px] font-mono mt-4">
          <a href="/" className="hover:text-accent-amber transition-colors">Back to site</a>
          <span className="mx-2">·</span>
          <span>Credentials provided by your admin</span>
        </p>
      </form>
    </div>
  )
}
