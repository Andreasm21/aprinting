import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Package, FileText, DollarSign, Info, MessageSquare, RotateCcw, ExternalLink, Menu, X, LayoutDashboard, Bell, Users, Receipt, Mail, BarChart3, Lock, LogOut, Boxes, UserCog, History } from 'lucide-react'
import QuoteCart from './components/QuoteCart'
import { useContentStore } from '@/stores/contentStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAuditLogStore } from '@/stores/auditLogStore'

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/notifications', label: 'Notifications', icon: Bell },
  { path: '/admin/customers', label: 'Customers', icon: Users },
  { path: '/admin/invoices', label: 'Invoices', icon: Receipt },
  { path: '/admin/quotations', label: 'Quotations', icon: FileText },
  { path: '/admin/emails', label: 'Emails', icon: Mail },
  { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/admin/activity', label: 'Activity Log', icon: History },
  { path: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { path: '/admin/products', label: 'Products', icon: Package },
  { path: '/admin/team', label: 'Team', icon: UserCog },
  { path: '/admin/hero', label: 'Hero Section', icon: FileText },
  { path: '/admin/services', label: 'Services', icon: FileText },
  { path: '/admin/pricing', label: 'Pricing', icon: DollarSign },
  { path: '/admin/about', label: 'About', icon: Info },
  { path: '/admin/contact', label: 'Contact', icon: MessageSquare },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const resetAll = useContentStore((s) => s.resetAll)
  const unreadCount = useNotificationsStore((s) => s.getUnreadCount())
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const loading = useAdminAuthStore((s) => s.loading)
  const bootstrap = useAdminAuthStore((s) => s.bootstrap)
  const restoreSession = useAdminAuthStore((s) => s.restoreSession)
  const login = useAdminAuthStore((s) => s.login)
  const logout = useAdminAuthStore((s) => s.logout)
  const auditLog = useAuditLogStore((s) => s.log)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Bootstrap admin users + restore session on mount
  useEffect(() => {
    (async () => {
      await bootstrap()
      await restoreSession()
    })()
  }, [bootstrap, restoreSession])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const result = await login(username, password)
    setSubmitting(false)
    if (!result.success) {
      setError(result.error || 'Login failed')
      setPassword('')
    } else {
      auditLog('login', 'system', `${username} signed in`)
      setUsername('')
      setPassword('')
    }
  }

  const handleLogout = () => {
    if (currentUser) auditLog('login', 'system', `${currentUser.username} signed out`)
    logout()
  }

  const handleReset = () => {
    if (confirmReset) {
      resetAll()
      setConfirmReset(false)
    } else {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 3000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="font-mono text-text-muted text-xs">[ INITIALIZING ADMIN ]</p>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm">
          <div className="card-base p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-accent-amber/10 flex items-center justify-center">
                <Lock size={24} className="text-accent-amber" />
              </div>
            </div>
            <div className="text-center mb-6">
              <div className="flex items-baseline justify-center gap-0 mb-1">
                <span className="font-mono text-xl font-bold text-accent-amber">A</span>
                <span className="font-mono text-xl font-bold text-text-primary">xiom</span>
              </div>
              <p className="text-text-muted text-xs font-mono">Admin Panel</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-text-muted text-xs font-mono uppercase mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError('') }}
                  placeholder="username"
                  autoFocus
                  required
                  className={`w-full bg-bg-tertiary border rounded-lg px-4 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-amber transition-colors ${error ? 'border-red-500' : 'border-border'}`}
                />
              </div>
              <div>
                <label className="block text-text-muted text-xs font-mono uppercase mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  required
                  className={`w-full bg-bg-tertiary border rounded-lg px-4 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-amber transition-colors ${error ? 'border-red-500' : 'border-border'}`}
                />
                {error && (
                  <p className="text-red-400 text-xs font-mono mt-1.5">{error}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-accent-amber text-bg-primary font-mono text-sm font-bold py-2.5 rounded-lg hover:bg-accent-amber/90 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Signing in...' : 'Login'}
              </button>
            </div>
          </div>
          <p className="text-center text-text-muted text-[10px] font-mono mt-4">
            <a href="/" className="hover:text-accent-amber transition-colors">Back to site</a>
          </p>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-bg-secondary border border-border rounded-lg"
      >
        {sidebarOpen ? <X size={20} className="text-text-primary" /> : <Menu size={20} className="text-text-primary" />}
      </button>

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-bg-secondary border-r border-border flex flex-col transition-transform lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-baseline gap-0">
            <span className="font-mono text-lg font-bold text-accent-amber">A</span>
            <span className="font-mono text-lg font-bold text-text-primary">xiom</span>
          </div>
          {currentUser && (
            <div className="mt-2 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-accent-amber/10 flex items-center justify-center">
                <span className="font-mono text-[10px] font-bold text-accent-amber">
                  {currentUser.displayName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-text-primary text-xs font-medium truncate">{currentUser.displayName}</p>
                <p className="text-text-muted text-[10px] font-mono truncate">@{currentUser.username}</p>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-mono transition-all ${
                  active
                    ? 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                }`}
              >
                <item.icon size={18} />
                {item.label}
                {item.label === 'Notifications' && unreadCount > 0 && (
                  <span className="ml-auto bg-accent-amber text-bg-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border space-y-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono text-text-secondary hover:text-accent-amber hover:bg-bg-tertiary transition-all"
          >
            <ExternalLink size={16} />
            View Site
          </a>
          <button
            onClick={handleReset}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono w-full transition-all ${
              confirmReset
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'text-text-muted hover:text-red-400 hover:bg-bg-tertiary'
            }`}
          >
            <RotateCcw size={16} />
            {confirmReset ? 'Click again to confirm' : 'Reset All Data'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono w-full text-text-muted hover:text-red-400 hover:bg-bg-tertiary transition-all"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <main className="flex-1 min-h-screen overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 lg:p-10">
          {children}
        </div>
      </main>

      {/* Global quote cart */}
      <QuoteCart />
    </div>
  )
}
