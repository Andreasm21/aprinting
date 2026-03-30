import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Package, FileText, DollarSign, Info, MessageSquare, RotateCcw, ExternalLink, Menu, X, LayoutDashboard, Bell, Users } from 'lucide-react'
import { useContentStore } from '@/stores/contentStore'
import { useNotificationsStore } from '@/stores/notificationsStore'

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/notifications', label: 'Notifications', icon: Bell },
  { path: '/admin/customers', label: 'Customers', icon: Users },
  { path: '/admin/products', label: 'Products', icon: Package },
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const handleReset = () => {
    if (confirmReset) {
      resetAll()
      setConfirmReset(false)
    } else {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 3000)
    }
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
            <span className="font-mono text-lg font-bold text-text-primary">Printing</span>
          </div>
          <p className="text-text-muted text-xs font-mono mt-1">Admin Panel</p>
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
    </div>
  )
}
