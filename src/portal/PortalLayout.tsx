import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, ShoppingCart, User, LogOut, Menu, X, Package } from 'lucide-react'
import { usePortalAuthStore } from '@/stores/portalAuthStore'
import PortalLogin from './PortalLogin'
import BrandLogo from '@/components/BrandLogo'

const navItems = [
  { path: '/portal', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/portal/store', label: 'Store', icon: Package },
  { path: '/portal/documents', label: 'Documents', icon: FileText },
  { path: '/portal/orders', label: 'Orders', icon: ShoppingCart },
  { path: '/portal/profile', label: 'Profile', icon: User },
]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { customer, isAuthenticated, loading, checkSession, logout } = usePortalAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    checkSession()
  }, [checkSession])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-muted font-mono text-sm">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated || !customer) {
    return <PortalLogin />
  }

  const initials = customer.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

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
          <BrandLogo size="xs" subtitle="Customer Portal" />
        </div>

        {/* Customer info */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-amber/10 flex items-center justify-center">
              <span className="font-mono text-sm font-bold text-accent-amber">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-text-primary text-sm font-medium truncate">{customer.name}</p>
              {customer.company && <p className="text-text-muted text-xs truncate">{customer.company}</p>}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
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
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border space-y-2">
          <a
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono text-text-secondary hover:text-accent-amber hover:bg-bg-tertiary transition-all"
          >
            Back to Site
          </a>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono w-full text-text-muted hover:text-red-400 hover:bg-bg-tertiary transition-all"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <main className="flex-1 min-h-screen overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  )
}
