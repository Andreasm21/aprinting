import { useState, useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Package, FileText, DollarSign, Info, MessageSquare, RotateCcw, ExternalLink,
  Menu, X, LayoutDashboard, Bell, Users, Mail, BarChart3, LogOut, Boxes,
  UserCog, History, ClipboardList, ChevronDown, Inbox, Printer, Receipt,
  ArrowLeftRight, Truck, ScanLine, FileBarChart, Image as ImageIcon, ListChecks,
  Folder,
} from 'lucide-react'
import QuoteCart from './components/QuoteCart'
import AdminChatBubble from './chat/AdminChatBubble'
import { useAdminTasksStore } from '@/stores/adminTasksStore'
import { useAdminClientChatStore } from '@/stores/adminClientChatStore'
import { useLeadsStore } from '@/stores/leadsStore'
import { useEmailsStore } from '@/stores/emailsStore'
import { useContentStore } from '@/stores/contentStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAuditLogStore } from '@/stores/auditLogStore'
import BrandLogo from '@/components/BrandLogo'
import bcrypt from 'bcryptjs'

type NavItem = {
  path: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
  badge?: 'notifications' | 'my-tasks' | 'client-chats' | 'leads' | 'mail'
  match?: (pathname: string) => boolean
}

type NavGroup = {
  id: string
  label: string
  icon: typeof LayoutDashboard
  defaultOpen?: boolean
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    id: 'intake',
    label: 'Intake',
    icon: Inbox,
    defaultOpen: true,
    items: [
      { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { path: '/admin/notifications', label: 'Requests', icon: Bell, badge: 'notifications' },
      { path: '/admin/conversations', label: 'Customer chats', icon: MessageSquare, badge: 'client-chats' },
      // Mail nav item shelved — page + route + stores remain in repo for the
      // moment since inbound webhook isn't fully wired in production yet.
      // Re-add when Resend Inbound delivers a real email and the loop closes.
      // { path: '/admin/mail', label: 'Mail', icon: Mail, badge: 'mail' },
      { path: '/admin/leads', label: 'Leads', icon: Inbox, badge: 'leads' },
      { path: '/admin/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    id: 'fulfillment',
    label: 'Fulfillment',
    icon: ClipboardList,
    defaultOpen: true,
    items: [
      {
        path: '/admin/orders',
        label: 'Orders',
        icon: ClipboardList,
        match: (pathname) => pathname === '/admin/orders' || /^\/admin\/orders\/(?!quotations|print|invoices)/.test(pathname),
      },
      { path: '/admin/orders/quotations', label: 'Quotations', icon: FileText },
      { path: '/admin/orders/print', label: 'Print', icon: Printer },
      { path: '/admin/orders/invoices', label: 'Payment', icon: Receipt },
      { path: '/admin/tasks', label: 'Tasks', icon: ListChecks, badge: 'my-tasks' },
    ],
  },
  {
    id: 'stock',
    label: 'Stock & Storefront',
    icon: Boxes,
    items: [
      { path: '/admin/inventory', label: 'Stock Overview', icon: Boxes, exact: true },
      { path: '/admin/inventory/products', label: 'Stock Products', icon: Package },
      { path: '/admin/inventory/movements', label: 'Movements', icon: ArrowLeftRight },
      { path: '/admin/inventory/orders', label: 'Purchase Orders', icon: Truck },
      { path: '/admin/inventory/scan', label: 'Scan', icon: ScanLine },
      { path: '/admin/inventory/reports', label: 'Reports', icon: FileBarChart },
      { path: '/admin/products', label: 'Storefront Products', icon: Package },
      { path: '/admin/stl-viewer', label: 'STL Viewer', icon: ImageIcon },
    ],
  },
  {
    id: 'quotation-support',
    label: 'Pricing & Comms',
    icon: DollarSign,
    items: [
      { path: '/admin/pricing', label: 'Pricing Engine', icon: DollarSign },
      { path: '/admin/emails', label: 'Emails', icon: Mail },
      { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    id: 'website',
    label: 'Website',
    icon: FileText,
    items: [
      { path: '/admin/hero', label: 'Hero Section', icon: FileText },
      { path: '/admin/services', label: 'Services', icon: FileText },
      { path: '/admin/about', label: 'About', icon: Info },
      { path: '/admin/contact', label: 'Contact', icon: MessageSquare },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: UserCog,
    items: [
      { path: '/admin/team', label: 'Team', icon: UserCog },
      { path: '/admin/files', label: 'Files', icon: Folder },
      { path: '/admin/activity', label: 'Activity Log', icon: History },
    ],
  },
]

function isNavItemActive(pathname: string, item: NavItem) {
  if (item.match) return item.match(pathname)
  if (item.exact) return pathname === item.path
  return pathname === item.path || pathname.startsWith(`${item.path}/`)
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const resetAll = useContentStore((s) => s.resetAll)
  const unreadCount = useNotificationsStore((s) => s.getUnreadCount())
  const tasks = useAdminTasksStore((s) => s.tasks)
  const loadTasks = useAdminTasksStore((s) => s.load)
  const hasLoadedTasks = useAdminTasksStore((s) => s.hasLoaded)
  const clientChats = useAdminClientChatStore((s) => s.threads)
  const messagesByThread = useAdminClientChatStore((s) => s.messagesByThread)
  const loadClientChats = useAdminClientChatStore((s) => s.load)
  const hasLoadedClientChats = useAdminClientChatStore((s) => s.hasLoaded)
  const leads = useLeadsStore((s) => s.leads)
  const loadLeads = useLeadsStore((s) => s.load)
  const hasLoadedLeads = useLeadsStore((s) => s.hasLoaded)
  const emailThreads = useEmailsStore((s) => s.threads)
  const loadEmails = useEmailsStore((s) => s.load)
  const hasLoadedEmails = useEmailsStore((s) => s.hasLoaded)
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const loading = useAdminAuthStore((s) => s.loading)
  const bootstrap = useAdminAuthStore((s) => s.bootstrap)
  const restoreSession = useAdminAuthStore((s) => s.restoreSession)
  const login = useAdminAuthStore((s) => s.login)
  const logout = useAdminAuthStore((s) => s.logout)
  const auditLog = useAuditLogStore((s) => s.log)

  const changePassword = useAdminAuthStore((s) => s.changePassword)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => (
    Object.fromEntries(navGroups.map((group) => [group.id, Boolean(group.defaultOpen)]))
  ))
  // First-login password change state
  const [forcedPwOld, setForcedPwOld] = useState('')
  const [forcedPwNew, setForcedPwNew] = useState('')
  const [forcedPwConfirm, setForcedPwConfirm] = useState('')
  const [forcedPwError, setForcedPwError] = useState('')
  const [forcedPwSubmitting, setForcedPwSubmitting] = useState(false)

  // Bootstrap admin users + restore session on mount
  useEffect(() => {
    (async () => {
      await bootstrap()
      await restoreSession()
    })()
  }, [bootstrap, restoreSession])

  // Lazy-load tasks once a user is signed in so the sidebar badge populates.
  useEffect(() => {
    if (currentUser && !hasLoadedTasks) void loadTasks()
  }, [currentUser, hasLoadedTasks, loadTasks])
  useEffect(() => {
    if (currentUser && !hasLoadedClientChats) void loadClientChats()
  }, [currentUser, hasLoadedClientChats, loadClientChats])
  useEffect(() => {
    if (currentUser && !hasLoadedLeads) void loadLeads()
  }, [currentUser, hasLoadedLeads, loadLeads])
  useEffect(() => {
    if (currentUser && !hasLoadedEmails) void loadEmails()
  }, [currentUser, hasLoadedEmails, loadEmails])

  const myOpenTasks = currentUser
    ? tasks.filter((t) => t.assignedTo === currentUser.id && t.status !== 'done').length
    : 0

  // Total unread visitor messages across all threads
  const clientChatsUnread = useMemo(() => {
    let total = 0
    for (const t of clientChats) {
      const msgs = messagesByThread.get(t.id) ?? []
      for (const m of msgs) {
        if (m.authorKind === 'visitor' && !m.readAt) total += 1
      }
    }
    return total
  }, [clientChats, messagesByThread])

  // Open leads (potential or working) — what needs attention
  const leadsBadge = useMemo(() => {
    return leads.filter((l) => l.status === 'potential' || l.status === 'working').length
  }, [leads])

  // Mail unread (sum of unread_count across non-archived threads)
  const mailBadge = useMemo(() => {
    return emailThreads.reduce((sum, t) => sum + (t.archived ? 0 : t.unreadCount), 0)
  }, [emailThreads])

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
        <div className="flex flex-col items-center gap-4">
          <BrandLogo size="lg" showWordmark={false} decorative markClassName="animate-pulse" />
          <p className="font-mono text-text-muted text-xs">[ INITIALIZING ADMIN ]</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm">
          <div className="card-base p-8">
            <div className="flex items-center justify-center mb-6">
              <BrandLogo size="lg" showWordmark={false} />
            </div>
            <div className="text-center mb-6">
              <BrandLogo size="sm" className="justify-center mb-1" markClassName="hidden" />
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

  // Force password change on first login (or after admin reset)
  if (currentUser.mustChangePassword) {
    const handleForcedChange = async (e: React.FormEvent) => {
      e.preventDefault()
      setForcedPwError('')
      if (forcedPwNew.length < 6) {
        setForcedPwError('New password must be at least 6 characters')
        return
      }
      if (forcedPwNew !== forcedPwConfirm) {
        setForcedPwError('Passwords do not match')
        return
      }
      // Verify the temporary password
      const valid = await bcrypt.compare(forcedPwOld, currentUser.passwordHash)
      if (!valid) {
        setForcedPwError('Current password is incorrect')
        return
      }
      setForcedPwSubmitting(true)
      await changePassword(currentUser.id, forcedPwNew, true)
      auditLog('update', 'system', `${currentUser.username} changed their password`)
      setForcedPwSubmitting(false)
      setForcedPwOld('')
      setForcedPwNew('')
      setForcedPwConfirm('')
    }

    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <form onSubmit={handleForcedChange} className="w-full max-w-sm">
          <div className="card-base p-8">
            <div className="flex items-center justify-center mb-6">
              <BrandLogo size="lg" showWordmark={false} />
            </div>
            <div className="text-center mb-6">
              <h2 className="font-mono text-base font-bold text-text-primary">Set Your Password</h2>
              <p className="text-text-muted text-xs font-mono mt-1">
                Welcome <span className="text-accent-amber">@{currentUser.username}</span> — please change your temporary password to continue.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-text-muted text-xs font-mono uppercase mb-1.5">Temporary Password</label>
                <input
                  type="password"
                  value={forcedPwOld}
                  onChange={(e) => { setForcedPwOld(e.target.value); setForcedPwError('') }}
                  required
                  autoFocus
                  className="input-field text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-text-muted text-xs font-mono uppercase mb-1.5">New Password</label>
                <input
                  type="password"
                  value={forcedPwNew}
                  onChange={(e) => { setForcedPwNew(e.target.value); setForcedPwError('') }}
                  required
                  minLength={6}
                  className="input-field text-sm font-mono"
                  placeholder="min 6 characters"
                />
              </div>
              <div>
                <label className="block text-text-muted text-xs font-mono uppercase mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={forcedPwConfirm}
                  onChange={(e) => { setForcedPwConfirm(e.target.value); setForcedPwError('') }}
                  required
                  className={`input-field text-sm font-mono ${forcedPwError ? 'border-red-500' : ''}`}
                />
                {forcedPwError && <p className="text-red-400 text-xs font-mono mt-1.5">{forcedPwError}</p>}
              </div>
              <button
                type="submit"
                disabled={forcedPwSubmitting}
                className="w-full bg-accent-amber text-bg-primary font-mono text-sm font-bold py-2.5 rounded-lg hover:bg-accent-amber/90 transition-colors disabled:opacity-50"
              >
                {forcedPwSubmitting ? 'Updating...' : 'Set Password'}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-text-muted text-xs font-mono hover:text-accent-amber"
              >
                Logout
              </button>
            </div>
          </div>
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
          <BrandLogo size="xs" subtitle="Admin Panel" />
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
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
          {navGroups.map((group) => {
            const groupHasActiveItem = group.items.some((item) => isNavItemActive(location.pathname, item))
            const groupOpen = openGroups[group.id] || groupHasActiveItem
            const groupUnreadCount =
              (group.items.some((item) => item.badge === 'notifications') ? unreadCount : 0) +
              (group.items.some((item) => item.badge === 'my-tasks') ? myOpenTasks : 0) +
              (group.items.some((item) => item.badge === 'client-chats') ? clientChatsUnread : 0) +
              (group.items.some((item) => item.badge === 'leads') ? leadsBadge : 0) +
              (group.items.some((item) => item.badge === 'mail') ? mailBadge : 0)
            const GroupIcon = group.icon
            return (
              <div key={group.id}>
                <button
                  type="button"
                  aria-expanded={groupOpen}
                  aria-controls={`admin-nav-${group.id}`}
                  onClick={() => setOpenGroups((current) => ({ ...current, [group.id]: !current[group.id] }))}
                  className={`flex w-full items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-wide transition-all ${
                    groupHasActiveItem
                      ? 'text-accent-amber bg-accent-amber/10'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
                  }`}
                >
                  <GroupIcon size={15} />
                  <span className="flex-1 text-left">{group.label}</span>
                  {groupUnreadCount > 0 && (
                    <span className="bg-accent-amber text-bg-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {groupUnreadCount}
                    </span>
                  )}
                  <ChevronDown size={14} className={`transition-transform ${groupOpen ? 'rotate-180' : ''}`} />
                </button>
                {groupOpen && (
                  <div id={`admin-nav-${group.id}`} className="mt-1 space-y-1">
                    {group.items.map((item) => {
                      const active = isNavItemActive(location.pathname, item)
                      const ItemIcon = item.icon
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
                          <ItemIcon size={17} />
                          <span className="flex-1">{item.label}</span>
                          {item.badge === 'notifications' && unreadCount > 0 && (
                            <span className="bg-accent-amber text-bg-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                              {unreadCount}
                            </span>
                          )}
                          {item.badge === 'my-tasks' && myOpenTasks > 0 && (
                            <span className="bg-accent-amber text-bg-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                              {myOpenTasks}
                            </span>
                          )}
                          {item.badge === 'client-chats' && clientChatsUnread > 0 && (
                            <span className="bg-accent-amber text-bg-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                              {clientChatsUnread}
                            </span>
                          )}
                          {item.badge === 'leads' && leadsBadge > 0 && (
                            <span className="bg-accent-amber text-bg-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                              {leadsBadge}
                            </span>
                          )}
                          {item.badge === 'mail' && mailBadge > 0 && (
                            <span className="bg-accent-amber text-bg-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                              {mailBadge}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
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

      {/* Main content. Full-bleed pages (e.g. STL viewer) opt out of the
          max-width + padding wrapper so they can use the entire main area. */}
      {(() => {
        const fullBleedPaths = ['/admin/stl-viewer']
        const isFullBleed = fullBleedPaths.some((p) => location.pathname === p)
        return (
          <main className={`flex-1 min-h-screen overflow-y-auto ${isFullBleed ? 'relative' : ''}`}>
            {isFullBleed ? (
              children
            ) : (
              <div className="max-w-5xl mx-auto p-6 lg:p-10">{children}</div>
            )}
          </main>
        )
      })()}

      {/* Global quote cart */}
      <QuoteCart />

      {/* Floating admin-only chat bubble (presence + chat) */}
      <AdminChatBubble />
    </div>
  )
}
