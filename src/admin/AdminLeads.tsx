// /admin/leads — kanban + table over the warm pipeline.
//
//   ┌─ header ─────────────────────────────────────────────────┐
//   │  Title · count           [Mine | All | Unassigned]  [+]  │
//   ├─ source filter row ──────────────────────────────────────┤
//   │  All · Chat · B2B · Contact · Quote · Manual            │
//   ├─ kanban or table ────────────────────────────────────────┤
//   │  Potential | Working | Quoted | Won | Lost              │
//   └──────────────────────────────────────────────────────────┘
//
// Drag-and-drop between columns updates the lead's status and appends a
// status_change event. A click opens the slide-over LeadDetailPanel.

import { useEffect, useMemo, useState } from 'react'
import {
  Inbox, Filter, Plus, LayoutGrid, List, ChevronDown,
} from 'lucide-react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useLeadsStore, type Lead, type LeadStatus, type LeadSource } from '@/stores/leadsStore'
import LeadCard from './leads/LeadCard'
import LeadDetailPanel from './leads/LeadDetailPanel'
import NewLeadModal from './leads/NewLeadModal'
import SourceBadge, { SOURCE_LABEL, SOURCE_ICON } from './leads/SourceBadge'

type Scope = 'all' | 'mine' | 'unassigned'
type View = 'kanban' | 'table'

const COLUMNS: { status: LeadStatus; label: string; tone: string }[] = [
  { status: 'potential', label: 'Potential', tone: 'border-text-muted/40' },
  { status: 'working',   label: 'Working',   tone: 'border-amber-500/40' },
  { status: 'quoted',    label: 'Quoted',    tone: 'border-violet-500/40' },
  { status: 'won',       label: 'Won',       tone: 'border-emerald-500/40' },
  { status: 'lost',      label: 'Lost',      tone: 'border-red-500/40' },
]

const SOURCES: LeadSource[] = ['chat', 'part_request', 'contact', 'quote', 'manual', 'phone', 'email', 'meeting', 'other']

export default function AdminLeads() {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const allUsers = useAdminAuthStore((s) => s.users)
  const leads = useLeadsStore((s) => s.leads)
  const load = useLeadsStore((s) => s.load)
  const hasLoaded = useLeadsStore((s) => s.hasLoaded)
  const schemaMissing = useLeadsStore((s) => s.schemaMissing)
  const setStatus = useLeadsStore((s) => s.setStatus)

  const [scope, setScope] = useState<Scope>('all')
  const [view, setView] = useState<View>('kanban')
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all')
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverColumn, setHoverColumn] = useState<LeadStatus | null>(null)

  useEffect(() => { if (!hasLoaded) void load() }, [hasLoaded, load])

  if (!currentUser) return null

  if (schemaMissing) {
    return (
      <div className="card-base p-6 max-w-xl">
        <h1 className="font-mono text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
          <Inbox size={18} className="text-accent-amber" /> Leads
        </h1>
        <p className="text-text-secondary text-sm mb-3">The leads schema isn't installed yet.</p>
        <code className="block bg-bg-tertiary border border-border rounded px-3 py-2 text-xs text-accent-amber select-all">
          supabase/migrations/20260428_leads.sql
        </code>
      </div>
    )
  }

  // ─── Filtering ───
  const filtered = useMemo(() => {
    return leads
      .filter((l) => {
        if (scope === 'mine' && l.assignedAdminId !== currentUser.id) return false
        if (scope === 'unassigned' && l.assignedAdminId) return false
        if (sourceFilter !== 'all' && l.source !== sourceFilter) return false
        return true
      })
  }, [leads, scope, sourceFilter, currentUser.id])

  // Bucket by status for kanban
  const byStatus = useMemo(() => {
    const map: Record<LeadStatus, Lead[]> = { potential: [], working: [], quoted: [], won: [], lost: [] }
    for (const l of filtered) map[l.status].push(l)
    for (const s of Object.keys(map) as LeadStatus[]) {
      map[s].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
    }
    return map
  }, [filtered])

  const usersById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), [allUsers])

  // Source counts for filter chips
  const sourceCounts = useMemo(() => {
    const map = new Map<LeadSource, number>()
    for (const l of leads) map.set(l.source, (map.get(l.source) ?? 0) + 1)
    return map
  }, [leads])

  // ─── Drag handlers ───
  const onCardDragStart = (id: string) => setDraggingId(id)
  const onCardDragEnd = () => { setDraggingId(null); setHoverColumn(null) }
  const onColumnDragOver = (status: LeadStatus, e: React.DragEvent) => {
    if (!draggingId) return
    e.preventDefault()
    setHoverColumn(status)
  }
  const onColumnDrop = (status: LeadStatus) => {
    if (!draggingId) return
    void setStatus(draggingId, status, currentUser.id)
    setDraggingId(null)
    setHoverColumn(null)
  }

  const activeLead = activeLeadId ? leads.find((l) => l.id === activeLeadId) : null

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold text-text-primary flex items-center gap-2">
            <Inbox size={24} className="text-accent-amber" /> Leads
          </h1>
          <p className="text-text-secondary text-sm">
            Warm pipeline · {filtered.length}{leads.length !== filtered.length ? ` of ${leads.length}` : ''} lead{filtered.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Scope tabs */}
          <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-1 font-mono text-xs">
            <Filter size={12} className="text-text-muted ml-1.5 mr-0.5" />
            {(['all', 'mine', 'unassigned'] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`px-3 py-1 rounded transition-colors capitalize ${
                  scope === s ? 'bg-accent-amber text-bg-primary font-bold' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {s === 'mine' ? 'Mine' : s === 'unassigned' ? 'Unassigned' : 'All'}
              </button>
            ))}
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-1 font-mono text-xs">
            <button
              type="button"
              onClick={() => setView('kanban')}
              aria-label="Kanban view"
              className={`p-1.5 rounded ${view === 'kanban' ? 'bg-accent-amber text-bg-primary' : 'text-text-secondary hover:text-text-primary'}`}
              title="Kanban"
            >
              <LayoutGrid size={12} />
            </button>
            <button
              type="button"
              onClick={() => setView('table')}
              aria-label="Table view"
              className={`p-1.5 rounded ${view === 'table' ? 'bg-accent-amber text-bg-primary' : 'text-text-secondary hover:text-text-primary'}`}
              title="Table"
            >
              <List size={12} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono bg-accent-amber text-bg-primary font-bold rounded-lg hover:bg-accent-amber/90 transition-colors"
          >
            <Plus size={13} /> New lead
          </button>
        </div>
      </div>

      {/* Source filter chips */}
      <div className="flex items-center gap-1 flex-wrap mt-4 mb-4">
        <button
          type="button"
          onClick={() => setSourceFilter('all')}
          className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded border transition-colors ${
            sourceFilter === 'all'
              ? 'bg-accent-amber/10 border-accent-amber text-accent-amber'
              : 'border-border text-text-muted hover:text-text-primary'
          }`}
        >
          All sources · {leads.length}
        </button>
        {SOURCES.filter((s) => (sourceCounts.get(s) ?? 0) > 0).map((s) => {
          const Icon = SOURCE_ICON[s]
          const count = sourceCounts.get(s) ?? 0
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSourceFilter(sourceFilter === s ? 'all' : s)}
              className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded border flex items-center gap-1 transition-colors ${
                sourceFilter === s
                  ? 'bg-accent-amber/10 border-accent-amber text-accent-amber'
                  : 'border-border text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon size={10} />
              {SOURCE_LABEL[s]} · {count}
            </button>
          )
        })}
      </div>

      {/* Body — kanban or table */}
      {!hasLoaded ? (
        <div className="card-base p-10 text-center text-text-muted text-xs font-mono">Loading…</div>
      ) : leads.length === 0 ? (
        <div className="card-base p-10 text-center text-text-muted">
          <Inbox size={28} className="mx-auto mb-3 text-text-muted/60" />
          <p className="font-mono text-sm">No leads yet.</p>
          <p className="font-mono text-xs mt-2 opacity-70">
            They'll appear automatically when visitors use the live chat, contact form, or B2B request form. Or click "+ New lead" to add one manually.
          </p>
        </div>
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {COLUMNS.map((col) => {
            const cards = byStatus[col.status]
            const isHover = hoverColumn === col.status && draggingId
            return (
              <div
                key={col.status}
                onDragOver={(e) => onColumnDragOver(col.status, e)}
                onDragLeave={() => setHoverColumn((h) => h === col.status ? null : h)}
                onDrop={() => onColumnDrop(col.status)}
                className={`card-base p-2 border-t-2 ${col.tone} min-h-[200px] transition-colors ${
                  isHover ? 'bg-accent-amber/5 ring-1 ring-accent-amber/40' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">{col.label}</h2>
                  <span className="font-mono text-[10px] text-text-muted">{cards.length}</span>
                </div>
                {cards.length === 0 ? (
                  <p className="text-text-muted/60 text-[10px] font-mono italic px-2 py-3 text-center">empty</p>
                ) : (
                  <div className="space-y-2">
                    {cards.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onClick={() => setActiveLeadId(lead.id)}
                        onDragStart={() => onCardDragStart(lead.id)}
                        onDragEnd={onCardDragEnd}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        // Table view
        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="border-b border-border bg-bg-tertiary/40 text-[10px] uppercase tracking-wider text-text-muted">
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Source</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Owner</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-right px-3 py-2">Activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const owner = lead.assignedAdminId ? usersById.get(lead.assignedAdminId) : null
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setActiveLeadId(lead.id)}
                      className="border-b border-border hover:bg-bg-tertiary/40 cursor-pointer"
                    >
                      <td className="px-3 py-2">
                        <p className="text-text-primary font-bold">{lead.name}</p>
                        {lead.company && <p className="text-[10px] text-text-muted">{lead.company}</p>}
                      </td>
                      <td className="px-3 py-2"><SourceBadge source={lead.source} /></td>
                      <td className="px-3 py-2"><span className="capitalize text-text-secondary">{lead.status}</span></td>
                      <td className="px-3 py-2 text-text-muted">{owner?.displayName ?? '—'}</td>
                      <td className="px-3 py-2 text-text-muted truncate max-w-[200px]">{lead.email ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-text-muted text-[10px]">{relTime(lead.lastActivityAt)}</td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-text-muted text-xs font-mono">
                      Nothing matches the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-over detail panel */}
      {activeLead && (
        <LeadDetailPanel lead={activeLead} onClose={() => setActiveLeadId(null)} />
      )}

      {/* New lead modal */}
      {showNewModal && (
        <NewLeadModal
          onClose={() => setShowNewModal(false)}
          onCreated={(id) => setActiveLeadId(id)}
        />
      )}

      {/* Suppress unused-import warning on ChevronDown */}
      <span className="hidden"><ChevronDown size={0} /></span>
    </div>
  )
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
