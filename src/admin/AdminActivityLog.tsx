import { useState, useMemo } from 'react'
import { History, Search, User, Trash2, AlertTriangle, Clock, Edit3, Lock, RotateCcw, Plus, TrendingUp, FileText } from 'lucide-react'
import { useAuditLogStore, type AuditAction, type AuditCategory } from '@/stores/auditLogStore'

const ACTION_ICONS: Record<AuditAction, typeof Plus> = {
  create: Plus,
  update: Edit3,
  delete: Trash2,
  status_change: TrendingUp,
  convert: FileText,
  lock: Lock,
  login: User,
  reset: RotateCcw,
}

const CATEGORY_COLORS: Record<AuditCategory, string> = {
  customer: 'text-accent-blue bg-accent-blue/10',
  invoice: 'text-accent-amber bg-accent-amber/10',
  quotation: 'text-accent-blue bg-accent-blue/10',
  notification: 'text-accent-green bg-accent-green/10',
  product: 'text-accent-amber bg-accent-amber/10',
  content: 'text-text-muted bg-bg-tertiary',
  system: 'text-red-400 bg-red-400/10',
}

const CATEGORIES: ('all' | AuditCategory)[] = ['all', 'customer', 'invoice', 'quotation', 'notification', 'product', 'content', 'system']

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDateTime(dateStr)
}

export default function AdminActivityLog() {
  const entries = useAuditLogStore((s) => s.entries)
  const clearAll = useAuditLogStore((s) => s.clearAll)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'all' | AuditCategory>('all')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')

  const filtered = useMemo(() => {
    return entries
      .filter((e) => category === 'all' || e.category === category)
      .filter((e) => {
        if (!search) return true
        const q = search.toLowerCase()
        return e.label.toLowerCase().includes(q) || (e.detail || '').toLowerCase().includes(q) || (e.actor || '').toLowerCase().includes(q)
      })
      .slice(0, 200)
  }, [entries, category, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length }
    for (const e of entries) c[e.category] = (c[e.category] || 0) + 1
    return c
  }, [entries])

  const handleClear = () => {
    if (clearConfirmText.trim().toLowerCase() !== 'delete') return
    clearAll()
    setShowClearConfirm(false)
    setClearConfirmText('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-mono text-2xl font-bold text-text-primary flex items-center gap-2">
            <History size={24} className="text-accent-amber" /> Activity Log
          </h1>
          <p className="text-text-secondary text-sm">Audit trail of all admin actions</p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={() => { setShowClearConfirm(true); setClearConfirmText('') }}
            className="text-xs font-mono py-2 px-4 rounded-lg border border-red-400 text-red-400 hover:bg-red-400/10 flex items-center gap-1.5"
          >
            <Trash2 size={13} /> Clear All
          </button>
        )}
      </div>

      <p className="text-text-muted text-xs font-mono mb-6">
        Showing {filtered.length} of {entries.length} entries · max 200 displayed
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by label, detail, or actor..."
            className="input-field pl-9 text-sm py-2"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-xs font-mono px-3 py-2 rounded-lg border transition-all capitalize ${
                category === c ? 'border-accent-amber text-accent-amber bg-accent-amber/5' : 'border-border text-text-muted hover:text-text-secondary'
              }`}
            >
              {c} <span className="ml-1 opacity-60">{counts[c] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Entries */}
      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <Clock size={32} className="mx-auto text-text-muted/20 mb-3" />
          <p className="text-text-muted text-sm font-mono">[ NO ACTIVITY ]</p>
        </div>
      ) : (
        <div className="card-base p-2">
          <div className="space-y-1">
            {filtered.map((entry) => {
              const Icon = ACTION_ICONS[entry.action] || Edit3
              const color = CATEGORY_COLORS[entry.category] || 'text-text-muted bg-bg-tertiary'
              return (
                <div key={entry.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-bg-tertiary/50">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${color}`}>
                    <Icon size={12} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-text-primary truncate">{entry.label}</p>
                      <span className="text-[9px] font-mono text-text-muted uppercase opacity-60">{entry.category}</span>
                    </div>
                    {entry.detail && <p className="text-[11px] text-text-muted truncate">{entry.detail}</p>}
                  </div>
                  {entry.actor && (
                    <span className="text-[10px] font-mono text-accent-amber shrink-0 hidden sm:flex items-center gap-1">
                      <User size={10} /> @{entry.actor}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-text-muted shrink-0 whitespace-nowrap">{timeAgo(entry.createdAt)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Clear confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-red-400/30 rounded-lg max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-400/10 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-mono text-base font-bold text-text-primary">Clear All Activity</h3>
                <p className="text-text-muted text-xs font-mono">Permanently delete {entries.length} entries</p>
              </div>
            </div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">
              Type <span className="text-red-400 font-bold">delete</span> to confirm
            </label>
            <input
              type="text"
              value={clearConfirmText}
              onChange={(e) => setClearConfirmText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && clearConfirmText.trim().toLowerCase() === 'delete') handleClear() }}
              autoFocus
              className="input-field text-sm font-mono mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowClearConfirm(false); setClearConfirmText('') }} className="btn-outline flex-1 text-sm py-2">Cancel</button>
              <button
                onClick={handleClear}
                disabled={clearConfirmText.trim().toLowerCase() !== 'delete'}
                className="flex-1 bg-red-400 text-bg-primary font-mono font-bold py-2 rounded-lg hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-sm"
              >
                <Trash2 size={14} /> Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
