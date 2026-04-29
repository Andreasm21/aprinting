// Slide-over panel for editing one lead. Pops over from the right edge.
//
// Surfaces:
//   • header — name, company, status pill, source badge, owner select, close X
//   • contact info — name / email / phone / company (edit-in-place, autosave on blur)
//   • notes — textarea, autosave on blur
//   • tags — chip input
//   • value + follow-up — small row
//   • action row — Mark working / Mark lost / Convert
//   • timeline — reverse-chronological lead_events with by-admin avatars
//
// Phase 2 keeps Convert and Mark Lost as inline confirmations to ship fast;
// Phase 4 will replace these with the dedicated modals from the plan.

import { useEffect, useMemo, useState } from 'react'
import {
  X, Mail, Phone, Building2, User, Calendar, Euro, Tag, Clock,
  ArrowRightCircle, CheckCircle, XCircle, MessageSquare, FileText,
  History, Package, AlertCircle, Hash,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useLeadsStore, type Lead, type LeadStatus, type LeadEvent } from '@/stores/leadsStore'
import { useInvoicesStore } from '@/stores/invoicesStore'
import SourceBadge, { SOURCE_LABEL } from './SourceBadge'

const URGENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'express',  label: 'Express' },
  { value: 'rush',     label: 'Rush' },
]

const MATERIAL_OPTIONS: { value: string; label: string }[] = [
  { value: '',          label: 'Not sure yet' },
  { value: 'fdm-pla',   label: 'FDM · PLA' },
  { value: 'fdm-petg',  label: 'FDM · PETG' },
  { value: 'fdm-abs',   label: 'FDM · ABS' },
  { value: 'fdm-asa',   label: 'FDM · ASA' },
  { value: 'fdm-tpu',   label: 'FDM · TPU' },
  { value: 'resin',     label: 'Resin' },
  { value: 'other',     label: 'Other / mixed' },
]

// Stable empty fallback so the selector returns the same ref between
// renders when there are no events yet (avoids React's "getSnapshot
// should be cached" infinite-loop guard).
const EMPTY_EVENTS: LeadEvent[] = []

interface Props {
  lead: Lead
  onClose: () => void
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const EVENT_LABEL: Record<LeadEvent['kind'], string> = {
  created: 'Lead created',
  contacted: 'Marked contacted',
  note: 'Note',
  status_change: 'Status changed',
  quote_sent: 'Quote sent',
  quote_accepted: 'Quote accepted',
  converted: 'Converted to customer',
  reassigned: 'Reassigned',
  followup_set: 'Follow-up set',
  tag_added: 'Tag added',
  source_added: 'New touchpoint',
}

export default function LeadDetailPanel({ lead, onClose }: Props) {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const allUsers = useAdminAuthStore((s) => s.users)
  const update = useLeadsStore((s) => s.update)
  const setStatus = useLeadsStore((s) => s.setStatus)
  const remove = useLeadsStore((s) => s.remove)
  const loadEvents = useLeadsStore((s) => s.loadEvents)
  const addEvent = useLeadsStore((s) => s.addEvent)
  const events = useLeadsStore((s) => s.eventsByLead.get(lead.id) ?? EMPTY_EVENTS)
  const createQuotationFromLead = useInvoicesStore((s) => s.createQuotationFromLead)
  const navigate = useNavigate()

  // Local edit buffers
  const [name, setName] = useState(lead.name)
  const [email, setEmail] = useState(lead.email ?? '')
  const [phone, setPhone] = useState(lead.phone ?? '')
  const [company, setCompany] = useState(lead.company ?? '')
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [tagsText, setTagsText] = useState(lead.tags.join(', '))
  const [estValue, setEstValue] = useState(lead.estimatedValueEur != null ? String(lead.estimatedValueEur) : '')
  const [followup, setFollowup] = useState(
    lead.nextFollowupAt ? new Date(lead.nextFollowupAt).toISOString().slice(0, 16) : '',
  )
  const [confirmAction, setConfirmAction] = useState<null | 'lost' | 'won' | 'delete' | 'quote'>(null)
  const [closedReason, setClosedReason] = useState('')
  // Scope draft state — feeds the eventual quotation pre-fill
  const [scopeDescription, setScopeDescription] = useState(lead.scopeDescription ?? '')
  const [scopeQuantity, setScopeQuantity] = useState(lead.scopeQuantity != null ? String(lead.scopeQuantity) : '')
  const [scopeMaterial, setScopeMaterial] = useState(lead.scopeMaterial ?? '')
  const [scopeUrgency, setScopeUrgency] = useState(lead.scopeUrgency ?? 'standard')
  const [creatingQuote, setCreatingQuote] = useState(false)

  useEffect(() => { void loadEvents(lead.id) }, [lead.id, loadEvents])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !confirmAction) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, confirmAction])

  const owner = lead.assignedAdminId ? allUsers.find((u) => u.id === lead.assignedAdminId) : undefined

  const usersById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), [allUsers])

  const persistContact = () => {
    update(lead.id, {
      name,
      email: email || undefined,
      phone: phone || undefined,
      company: company || undefined,
    }, currentUser?.id)
  }

  const persistNotes = () => {
    if (notes !== (lead.notes ?? '')) {
      update(lead.id, { notes }, currentUser?.id)
    }
  }

  const persistTags = () => {
    const arr = tagsText.split(',').map((t) => t.trim()).filter(Boolean)
    const same = arr.length === lead.tags.length && arr.every((t, i) => t === lead.tags[i])
    if (!same) update(lead.id, { tags: arr }, currentUser?.id)
  }

  const persistValue = () => {
    const n = estValue ? parseFloat(estValue) : undefined
    if ((n ?? null) !== (lead.estimatedValueEur ?? null)) {
      update(lead.id, { estimatedValueEur: n }, currentUser?.id)
    }
  }

  const persistFollowup = () => {
    const iso = followup ? new Date(followup).toISOString() : undefined
    if (iso !== lead.nextFollowupAt) {
      update(lead.id, { nextFollowupAt: iso }, currentUser?.id)
    }
  }

  const persistScope = () => {
    const qty = scopeQuantity ? parseInt(scopeQuantity, 10) : undefined
    const updates: Parameters<typeof update>[1] = {}
    if (scopeDescription !== (lead.scopeDescription ?? '')) updates.scopeDescription = scopeDescription || undefined
    if ((qty ?? null) !== (lead.scopeQuantity ?? null)) updates.scopeQuantity = qty && Number.isFinite(qty) ? qty : undefined
    if (scopeMaterial !== (lead.scopeMaterial ?? '')) updates.scopeMaterial = scopeMaterial || undefined
    if (scopeUrgency !== (lead.scopeUrgency ?? 'standard')) updates.scopeUrgency = scopeUrgency
    if (Object.keys(updates).length > 0) update(lead.id, updates, currentUser?.id)
  }

  const handleStatus = (next: LeadStatus, reason?: string) => {
    if (!currentUser) return
    void setStatus(lead.id, next, currentUser.id, reason)
  }

  /** Pre-fill a draft quotation from this lead's scope, link it back, flip
   *  the lead to 'quoted', and navigate to the quotations page so the admin
   *  can fill in costs. */
  const handleCreateQuote = async () => {
    if (!currentUser) return
    setCreatingQuote(true)
    // Persist any unsaved scope edits first so the quote inherits them
    persistScope()
    // Tiny defer so the optimistic update has flushed
    await new Promise((r) => setTimeout(r, 30))
    const documentId = createQuotationFromLead(lead.id)
    if (documentId) {
      // Link + status flip + timeline event
      await update(lead.id, { documentId }, currentUser.id)
      await setStatus(lead.id, 'quoted', currentUser.id)
      await addEvent(lead.id, 'quote_sent', currentUser.id, `Draft quotation created`, { document_id: documentId })
      onClose()
      navigate('/admin/orders/quotations')
    }
    setCreatingQuote(false)
  }

  const handleAssign = (id: string) => {
    update(lead.id, { assignedAdminId: id || undefined }, currentUser?.id)
  }

  if (!currentUser) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
        onClick={() => !confirmAction && onClose()}
      />

      {/* Slide-over */}
      <div
        className="fixed top-0 right-0 z-[71] h-full w-full max-w-md bg-bg-secondary border-l border-border shadow-2xl flex flex-col font-mono overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-bg-tertiary/40 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-text-primary truncate">{lead.name}</h2>
              <StatusPill status={lead.status} />
              <SourceBadge source={lead.source} />
            </div>
            <p className="text-text-muted text-[10px] mt-1 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Clock size={9} /> updated {formatTime(lead.lastActivityAt)}
              </span>
              {lead.closedAt && (
                <span>· closed {formatTime(lead.closedAt)}</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-text-muted hover:text-text-primary p-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Contact */}
          <Section title="Contact">
            <FieldRow icon={User} label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} onBlur={persistContact} className="input-field text-xs py-1.5" />
            </FieldRow>
            <FieldRow icon={Mail} label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={persistContact} placeholder="—" className="input-field text-xs py-1.5" />
            </FieldRow>
            <FieldRow icon={Phone} label="Phone">
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={persistContact} placeholder="—" className="input-field text-xs py-1.5" />
            </FieldRow>
            <FieldRow icon={Building2} label="Company">
              <input value={company} onChange={(e) => setCompany(e.target.value)} onBlur={persistContact} placeholder="—" className="input-field text-xs py-1.5" />
            </FieldRow>
          </Section>

          {/* Status + assignment row */}
          <Section title="Pipeline">
            <FieldRow icon={ArrowRightCircle} label="Status">
              <select
                value={lead.status}
                onChange={(e) => handleStatus(e.target.value as LeadStatus)}
                className="input-field text-xs py-1.5 capitalize"
              >
                <option value="potential">Potential</option>
                <option value="working">Working</option>
                <option value="quoted">Quoted</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </FieldRow>
            <FieldRow icon={User} label="Owner">
              <select
                value={lead.assignedAdminId ?? ''}
                onChange={(e) => handleAssign(e.target.value)}
                className="input-field text-xs py-1.5"
              >
                <option value="">Unassigned</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.displayName}{u.id === currentUser.id ? ' (you)' : ''}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow icon={Euro} label="Est. value (€)">
              <input type="number" step="0.01" value={estValue} onChange={(e) => setEstValue(e.target.value)} onBlur={persistValue} placeholder="—" className="input-field text-xs py-1.5" />
            </FieldRow>
            <FieldRow icon={Calendar} label="Follow-up">
              <input type="datetime-local" value={followup} onChange={(e) => setFollowup(e.target.value)} onBlur={persistFollowup} className="input-field text-xs py-1.5" />
            </FieldRow>
          </Section>

          {/* Tags */}
          <Section title="Tags">
            <FieldRow icon={Tag} label="">
              <input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                onBlur={persistTags}
                placeholder="comma, separated, tags"
                className="input-field text-xs py-1.5"
              />
            </FieldRow>
          </Section>

          {/* What they want — feeds the quotation */}
          <Section title="What they want (rough)" icon={Package}>
            <textarea
              value={scopeDescription}
              onChange={(e) => setScopeDescription(e.target.value)}
              onBlur={persistScope}
              placeholder='e.g. "10 parts of label boxes", "single prototype housing", "custom desk organiser set"'
              rows={3}
              className="input-field text-xs resize-y"
            />
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div>
                <label className="block text-[9px] uppercase text-text-muted tracking-wider mb-1 flex items-center gap-1">
                  <Hash size={9} /> Qty
                </label>
                <input
                  type="number"
                  min={1}
                  value={scopeQuantity}
                  onChange={(e) => setScopeQuantity(e.target.value)}
                  onBlur={persistScope}
                  placeholder="—"
                  className="input-field text-xs py-1.5"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-text-muted tracking-wider mb-1">Material</label>
                <select
                  value={scopeMaterial}
                  onChange={(e) => { setScopeMaterial(e.target.value); persistScope() }}
                  className="input-field text-xs py-1.5"
                >
                  {MATERIAL_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] uppercase text-text-muted tracking-wider mb-1 flex items-center gap-1">
                  <AlertCircle size={9} /> Urgency
                </label>
                <select
                  value={scopeUrgency}
                  onChange={(e) => { setScopeUrgency(e.target.value); persistScope() }}
                  className="input-field text-xs py-1.5"
                >
                  {URGENCY_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quotation handoff — most important action on this panel */}
            {!lead.documentId ? (
              <button
                type="button"
                onClick={() => setConfirmAction('quote')}
                disabled={creatingQuote}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-accent-amber text-bg-primary font-bold text-[11px] uppercase tracking-wider hover:bg-accent-amber/90 disabled:opacity-50 transition-colors"
              >
                <FileText size={12} /> Create quotation from this lead
              </button>
            ) : (
              <div className="mt-3 px-3 py-2 rounded border border-violet-500/30 bg-violet-500/5 text-[11px] text-violet-300 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <FileText size={11} /> Quotation already drafted
                </span>
                <a
                  href="/admin/orders/quotations"
                  className="text-accent-amber hover:underline"
                  onClick={onClose}
                >
                  Open →
                </a>
              </div>
            )}
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={persistNotes}
              placeholder="Anything worth remembering — call summary, next-step ideas, blockers…"
              rows={4}
              className="input-field text-xs resize-y"
            />
          </Section>

          {/* Lifecycle actions */}
          <Section title="Actions">
            <div className="flex flex-wrap gap-1.5">
              {lead.status !== 'won' && (
                <button
                  type="button"
                  onClick={() => setConfirmAction('won')}
                  className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1"
                >
                  <CheckCircle size={11} /> Mark won
                </button>
              )}
              {lead.status !== 'lost' && (
                <button
                  type="button"
                  onClick={() => setConfirmAction('lost')}
                  className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded border border-border hover:border-red-500/40 text-text-secondary hover:text-red-400 flex items-center gap-1"
                >
                  <XCircle size={11} /> Mark lost
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmAction('delete')}
                className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded border border-border hover:border-red-500/40 text-text-secondary hover:text-red-400 ml-auto"
              >
                Delete
              </button>
            </div>
            {confirmAction && (
              <div className="mt-2 p-3 rounded border border-amber-500/40 bg-amber-500/5 space-y-2">
                <p className="text-[11px] text-text-secondary">
                  {confirmAction === 'lost' && 'Mark this lead as lost?'}
                  {confirmAction === 'won' && 'Mark as won? (Phase 4 will add a customer-conversion modal here.)'}
                  {confirmAction === 'delete' && 'Delete this lead and all its events? This cannot be undone.'}
                  {confirmAction === 'quote' && (
                    <>
                      Create a draft quotation pre-filled from this lead?<br />
                      You'll be taken to <span className="text-accent-amber">/admin/orders/quotations</span> to fill in costs.
                      The lead will move to <span className="text-violet-300">Quoted</span>.
                    </>
                  )}
                </p>
                {(confirmAction === 'lost' || confirmAction === 'won') && (
                  <input
                    placeholder={confirmAction === 'lost' ? 'Reason (cost / timing / no fit / ghosted)' : 'Notes (e.g. quote XYZ accepted)'}
                    value={closedReason}
                    onChange={(e) => setClosedReason(e.target.value)}
                    className="input-field text-xs py-1.5"
                  />
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setConfirmAction(null); setClosedReason('') }}
                    className="text-[10px] uppercase tracking-wider px-2 py-1 text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmAction === 'delete') {
                        void remove(lead.id)
                        onClose()
                      } else if (confirmAction === 'quote') {
                        void handleCreateQuote()
                      } else {
                        handleStatus(confirmAction, closedReason || undefined)
                      }
                      setConfirmAction(null)
                      setClosedReason('')
                    }}
                    className="text-[10px] uppercase tracking-wider px-3 py-1 rounded bg-accent-amber text-bg-primary font-bold"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* Activity timeline */}
          <Section title="Activity" icon={History}>
            {events.length === 0 ? (
              <p className="text-[11px] text-text-muted">No events yet.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((ev) => {
                  const author = ev.byAdminId ? usersById.get(ev.byAdminId) : null
                  return (
                    <li key={ev.id} className="flex gap-2 text-[11px]">
                      <div className="w-5 h-5 rounded-full bg-accent-amber/10 text-accent-amber text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                        {author ? initials(author.displayName) : <DotIconForKind kind={ev.kind} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-text-secondary leading-tight">
                          <span className="text-text-primary">{author?.displayName ?? 'System'}</span>
                          <span className="text-text-muted"> · {EVENT_LABEL[ev.kind] ?? ev.kind}</span>
                        </p>
                        {ev.body && (
                          <p className="text-text-muted mt-0.5 italic">{ev.body}</p>
                        )}
                        <p className="text-text-muted/70 text-[9px] mt-0.5">{formatTime(ev.createdAt)}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          {/* Source detail (if linked) */}
          {(lead.source === 'chat' && lead.sourceId) && (
            <Section title="Linked chat">
              <a
                href="/admin/conversations"
                className="text-[11px] text-accent-amber hover:underline flex items-center gap-1"
              >
                <MessageSquare size={11} /> Open conversation →
              </a>
            </Section>
          )}
          {lead.source === 'part_request' && lead.sourceId && (
            <Section title="Linked request">
              <a
                href="/admin/notifications"
                className="text-[11px] text-accent-amber hover:underline flex items-center gap-1"
              >
                <FileText size={11} /> Open in requests inbox →
              </a>
            </Section>
          )}

          {/* Footer hint */}
          <p className="text-[9px] text-text-muted text-center pt-2 opacity-60">
            Origin: {SOURCE_LABEL[lead.source]} · Owner: {owner?.displayName ?? 'unassigned'}
          </p>
        </div>
      </div>
    </>
  )
}

// ─── Sub-components ──────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ComponentType<{ size?: number; className?: string }>; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1">
        {Icon && <Icon size={10} />}
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function FieldRow({ icon: Icon, label, children }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={11} className="text-text-muted flex-shrink-0" />
      {label && <span className="text-[10px] uppercase text-text-muted tracking-wider w-20 flex-shrink-0">{label}</span>}
      <div className="flex-1">{children}</div>
    </div>
  )
}

function StatusPill({ status }: { status: LeadStatus }) {
  const tone: Record<LeadStatus, string> = {
    potential: 'bg-text-muted/10 text-text-muted',
    working:   'bg-amber-500/10 text-amber-400',
    quoted:    'bg-violet-500/10 text-violet-400',
    won:       'bg-emerald-500/10 text-emerald-400',
    lost:      'bg-red-500/10 text-red-400',
  }
  return (
    <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${tone[status]}`}>
      {status}
    </span>
  )
}

function DotIconForKind({ kind }: { kind: LeadEvent['kind'] }) {
  return <span aria-label={kind} className="block w-1 h-1 bg-text-muted rounded-full" />
}
