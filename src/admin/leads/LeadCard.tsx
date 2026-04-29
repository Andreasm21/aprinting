// One kanban card. Compact, scannable. Click to open the detail panel.
// Drag-handle behaviour comes from the parent column wiring.

import { Clock, User, Euro } from 'lucide-react'
import type { Lead } from '@/stores/leadsStore'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import SourceBadge from './SourceBadge'

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)
}

function relTime(iso: string): { label: string; stale: boolean } {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return { label: 'just now', stale: false }
  if (m < 60) return { label: `${m}m ago`, stale: false }
  const h = Math.floor(m / 60)
  if (h < 24) return { label: `${h}h ago`, stale: false }
  const d = Math.floor(h / 24)
  return { label: `${d}d ago`, stale: d > 5 }
}

interface Props {
  lead: Lead
  onClick: () => void
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
}

export default function LeadCard({ lead, onClick, onDragStart, onDragEnd }: Props) {
  const allUsers = useAdminAuthStore((s) => s.users)
  const owner = lead.assignedAdminId ? allUsers.find((u) => u.id === lead.assignedAdminId) : undefined
  const t = relTime(lead.lastActivityAt)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className="cursor-grab active:cursor-grabbing rounded-lg border border-border bg-bg-tertiary/40 hover:border-accent-amber hover:bg-bg-tertiary/70 transition-colors p-2.5 text-left font-mono"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0 flex-1">
          <p className="text-text-primary text-xs font-bold truncate">{lead.name}</p>
          {lead.company && (
            <p className="text-text-muted text-[10px] truncate">{lead.company}</p>
          )}
        </div>
        <SourceBadge source={lead.source} />
      </div>

      {/* Source label snippet */}
      {lead.sourceLabel && (
        <p className="text-text-secondary text-[11px] mt-1 leading-relaxed line-clamp-2 italic">
          {lead.sourceLabel}
        </p>
      )}

      {/* Footer row */}
      <div className="flex items-center gap-2 mt-2 text-[9px] text-text-muted">
        <span className={`flex items-center gap-1 ${t.stale ? 'text-amber-400' : ''}`}>
          <Clock size={9} /> {t.label}
        </span>
        {lead.estimatedValueEur != null && (
          <span className="flex items-center gap-0.5 text-text-secondary">
            <Euro size={9} />{lead.estimatedValueEur.toFixed(0)}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {owner ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full bg-accent-amber/10 text-accent-amber font-bold text-[8px] flex items-center justify-center">
                {initials(owner.displayName)}
              </span>
              <span className="text-text-muted">{owner.displayName.split(' ')[0]}</span>
            </>
          ) : (
            <span className="flex items-center gap-1 text-text-muted/70">
              <User size={9} /> unassigned
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
