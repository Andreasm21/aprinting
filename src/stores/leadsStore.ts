// Leads store — warm pipeline between intake (chat / B2B / contact / quote)
// and paying customers.
//
// Backed by `leads` + `lead_events` tables. Everything streams via realtime
// so multiple admins see the same kanban without refresh.

import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export type LeadStatus = 'potential' | 'working' | 'quoted' | 'won' | 'lost'

export type LeadSource =
  | 'chat'
  | 'part_request'
  | 'contact'
  | 'quote'
  | 'manual'
  | 'phone'
  | 'email'
  | 'meeting'
  | 'other'

export type LeadEventKind =
  | 'created'
  | 'contacted'
  | 'note'
  | 'status_change'
  | 'quote_sent'
  | 'quote_accepted'
  | 'converted'
  | 'reassigned'
  | 'followup_set'
  | 'tag_added'
  | 'source_added'

export interface Lead {
  id: string
  status: LeadStatus
  name: string
  email?: string
  phone?: string
  company?: string
  source: LeadSource
  sourceId?: string
  sourceLabel?: string
  assignedAdminId?: string
  notes?: string
  tags: string[]
  customerId?: string
  documentId?: string
  estimatedValueEur?: number
  nextFollowupAt?: string
  createdAt: string
  lastActivityAt: string
  closedAt?: string
  closedReason?: string
}

export interface LeadEvent {
  id: string
  leadId: string
  kind: LeadEventKind
  byAdminId?: string
  body?: string
  data?: Record<string, unknown>
  createdAt: string
}

// ───────────────────────── Row converters ─────────────────────────

interface LeadRow {
  id: string
  status: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  source: string
  source_id: string | null
  source_label: string | null
  assigned_admin_id: string | null
  notes: string | null
  tags: string[] | null
  customer_id: string | null
  document_id: string | null
  estimated_value_eur: number | string | null
  next_followup_at: string | null
  created_at: string
  last_activity_at: string
  closed_at: string | null
  closed_reason: string | null
}

function leadFromRow(r: LeadRow): Lead {
  return {
    id: r.id,
    status: (r.status as LeadStatus) ?? 'potential',
    name: r.name,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    company: r.company ?? undefined,
    source: (r.source as LeadSource) ?? 'other',
    sourceId: r.source_id ?? undefined,
    sourceLabel: r.source_label ?? undefined,
    assignedAdminId: r.assigned_admin_id ?? undefined,
    notes: r.notes ?? undefined,
    tags: Array.isArray(r.tags) ? r.tags : [],
    customerId: r.customer_id ?? undefined,
    documentId: r.document_id ?? undefined,
    estimatedValueEur:
      r.estimated_value_eur == null
        ? undefined
        : typeof r.estimated_value_eur === 'string'
          ? parseFloat(r.estimated_value_eur) || undefined
          : r.estimated_value_eur,
    nextFollowupAt: r.next_followup_at ?? undefined,
    createdAt: r.created_at,
    lastActivityAt: r.last_activity_at,
    closedAt: r.closed_at ?? undefined,
    closedReason: r.closed_reason ?? undefined,
  }
}

interface EventRow {
  id: string
  lead_id: string
  kind: string
  by_admin_id: string | null
  body: string | null
  data: Record<string, unknown> | null
  created_at: string
}
function eventFromRow(r: EventRow): LeadEvent {
  return {
    id: r.id,
    leadId: r.lead_id,
    kind: r.kind as LeadEventKind,
    byAdminId: r.by_admin_id ?? undefined,
    body: r.body ?? undefined,
    data: r.data ?? undefined,
    createdAt: r.created_at,
  }
}

let _warned = false
let _realtimeStarted = false

// ───────────────────────── Store ────────────────────────────────

interface State {
  leads: Lead[]
  eventsByLead: Map<string, LeadEvent[]>
  loading: boolean
  hasLoaded: boolean
  schemaMissing: boolean

  load: () => Promise<void>
  loadEvents: (leadId: string) => Promise<void>

  /** Insert a new lead OR — if a lead with the same lower(email) already
   *  exists — append a `source_added` event and bump last_activity_at on
   *  the existing one. Returns the lead id (existing or new). */
  upsertFromIntake: (input: {
    name: string
    email?: string
    phone?: string
    company?: string
    source: LeadSource
    sourceId?: string
    sourceLabel?: string
    initialStatus?: LeadStatus
  }) => Promise<string | null>

  /** Manual creation from the admin UI. */
  create: (input: Omit<Lead, 'id' | 'createdAt' | 'lastActivityAt' | 'tags'> & { tags?: string[] }, byAdminId: string) => Promise<Lead | null>

  update: (id: string, updates: Partial<Pick<Lead, 'name' | 'email' | 'phone' | 'company' | 'notes' | 'tags' | 'estimatedValueEur' | 'nextFollowupAt' | 'assignedAdminId'>>, byAdminId?: string) => Promise<void>

  setStatus: (id: string, status: LeadStatus, byAdminId: string, reason?: string) => Promise<void>

  remove: (id: string) => Promise<void>

  addEvent: (leadId: string, kind: LeadEventKind, byAdminId?: string, body?: string, data?: Record<string, unknown>) => Promise<void>

  // Selectors
  byId: (id: string) => Lead | undefined
  byEmail: (email: string) => Lead | undefined
  byStatus: (status: LeadStatus) => Lead[]
  unassignedCount: () => number
  myCount: (adminId: string) => number

  // Internal
  _onLeadInserted: (l: Lead) => void
  _onLeadUpdated: (l: Lead) => void
  _onLeadDeleted: (id: string) => void
  _onEventInserted: (e: LeadEvent) => void
}

export const useLeadsStore = create<State>((set, get) => ({
  leads: [],
  eventsByLead: new Map(),
  loading: false,
  hasLoaded: false,
  schemaMissing: false,

  load: async () => {
    if (!isSupabaseConfigured) { set({ hasLoaded: true }); return }
    if (get().loading || get().hasLoaded) return
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('last_activity_at', { ascending: false })
        .limit(1000)
      if (error) {
        const code = (error as { code?: string }).code
        const tableMissing =
          code === '42P01' || code === 'PGRST205' ||
          /Could not find the table/i.test(error.message ?? '') ||
          /relation .* does not exist/i.test(error.message ?? '')
        if (tableMissing) {
          if (!_warned) {
            _warned = true
            console.info('[leads] table not found — apply supabase/migrations/20260428_leads.sql')
          }
          set({ loading: false, hasLoaded: true, schemaMissing: true })
          return
        }
        console.error('[leads] load:', error.message)
        set({ loading: false, hasLoaded: true })
        return
      }
      set({
        leads: ((data ?? []) as LeadRow[]).map(leadFromRow),
        loading: false,
        hasLoaded: true,
      })
      if (!_realtimeStarted) {
        _realtimeStarted = true
        startRealtime()
      }
    } catch (err) {
      console.error('[leads] load:', err)
      set({ loading: false, hasLoaded: true })
    }
  },

  loadEvents: async (leadId) => {
    if (!isSupabaseConfigured) return
    try {
      const { data, error } = await supabase
        .from('lead_events')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
      if (error) {
        console.error('[leads] loadEvents:', error.message)
        return
      }
      const events = ((data ?? []) as EventRow[]).map(eventFromRow)
      set((s) => {
        const next = new Map(s.eventsByLead)
        next.set(leadId, events)
        return { eventsByLead: next }
      })
    } catch (err) {
      console.error('[leads] loadEvents:', err)
    }
  },

  // Idempotent intake → lead. Looks up by email (case-insensitive). If
  // a lead exists, appends a `source_added` event. Otherwise inserts new.
  upsertFromIntake: async (input) => {
    if (!isSupabaseConfigured || get().schemaMissing) return null
    const email = input.email?.trim().toLowerCase()

    // 1. If we have an email, try to find an existing lead first
    if (email) {
      // Check the local cache first
      const existing = get().leads.find((l) => l.email?.toLowerCase() === email)
      if (existing) {
        await get().addEvent(existing.id, 'source_added', undefined,
          `Touched again via ${input.source}${input.sourceLabel ? `: ${input.sourceLabel}` : ''}`,
          { source: input.source, source_id: input.sourceId })
        // Bump last_activity_at
        await supabase.from('leads')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', existing.id)
        return existing.id
      }
      // Cache might be cold — also check the DB
      const { data: existingRow } = await supabase
        .from('leads')
        .select('*')
        .filter('email', 'ilike', email)
        .limit(1)
        .maybeSingle()
      if (existingRow) {
        const lead = leadFromRow(existingRow as LeadRow)
        get()._onLeadInserted(lead)
        await get().addEvent(lead.id, 'source_added', undefined,
          `Touched again via ${input.source}${input.sourceLabel ? `: ${input.sourceLabel}` : ''}`,
          { source: input.source, source_id: input.sourceId })
        await supabase.from('leads')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', lead.id)
        return lead.id
      }
    }

    // 2. No match → insert new
    try {
      const { data, error } = await supabase.from('leads')
        .insert({
          name: input.name.trim(),
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          company: input.company?.trim() || null,
          source: input.source,
          source_id: input.sourceId ?? null,
          source_label: input.sourceLabel ?? null,
          status: input.initialStatus ?? 'potential',
        })
        .select()
        .single()
      if (error || !data) {
        console.warn('[leads] upsertFromIntake:', error?.message)
        return null
      }
      const lead = leadFromRow(data as LeadRow)
      get()._onLeadInserted(lead)
      await get().addEvent(lead.id, 'created', undefined,
        `Lead created from ${input.source}`,
        { source: input.source, source_id: input.sourceId })
      return lead.id
    } catch (err) {
      console.warn('[leads] upsertFromIntake:', err)
      return null
    }
  },

  create: async (input, byAdminId) => {
    if (!isSupabaseConfigured || get().schemaMissing) return null
    try {
      const { data, error } = await supabase.from('leads')
        .insert({
          name: input.name.trim(),
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          company: input.company?.trim() || null,
          source: input.source,
          source_id: input.sourceId ?? null,
          source_label: input.sourceLabel ?? null,
          status: input.status ?? 'potential',
          assigned_admin_id: input.assignedAdminId ?? null,
          notes: input.notes ?? null,
          tags: input.tags ?? [],
          estimated_value_eur: input.estimatedValueEur ?? null,
          next_followup_at: input.nextFollowupAt ?? null,
        })
        .select()
        .single()
      if (error || !data) {
        console.error('[leads] create:', error?.message)
        return null
      }
      const lead = leadFromRow(data as LeadRow)
      get()._onLeadInserted(lead)
      await get().addEvent(lead.id, 'created', byAdminId, 'Lead created manually', { source: input.source })
      return lead
    } catch (err) {
      console.error('[leads] create:', err)
      return null
    }
  },

  update: async (id, updates, byAdminId) => {
    if (!isSupabaseConfigured) return
    const row: Record<string, unknown> = { last_activity_at: new Date().toISOString() }
    if (updates.name != null) row.name = updates.name
    if ('email' in updates) row.email = updates.email?.trim() || null
    if ('phone' in updates) row.phone = updates.phone?.trim() || null
    if ('company' in updates) row.company = updates.company?.trim() || null
    if ('notes' in updates) row.notes = updates.notes ?? null
    if ('tags' in updates) row.tags = updates.tags ?? []
    if ('estimatedValueEur' in updates) row.estimated_value_eur = updates.estimatedValueEur ?? null
    if ('nextFollowupAt' in updates) row.next_followup_at = updates.nextFollowupAt ?? null
    if ('assignedAdminId' in updates) row.assigned_admin_id = updates.assignedAdminId ?? null

    // Optimistic local merge
    set((s) => ({ leads: s.leads.map((l) => l.id === id ? { ...l, ...updates, lastActivityAt: new Date().toISOString() } : l) }))

    try {
      const { error } = await supabase.from('leads').update(row).eq('id', id)
      if (error) console.error('[leads] update:', error.message)

      // Append events for actions worth surfacing in the timeline
      if ('assignedAdminId' in updates) {
        await get().addEvent(id, 'reassigned', byAdminId,
          updates.assignedAdminId ? `Reassigned` : 'Unassigned',
          { admin_id: updates.assignedAdminId })
      }
      if ('nextFollowupAt' in updates && updates.nextFollowupAt) {
        await get().addEvent(id, 'followup_set', byAdminId,
          `Follow-up set for ${new Date(updates.nextFollowupAt).toLocaleString()}`,
          { followup_at: updates.nextFollowupAt })
      }
    } catch (err) {
      console.error('[leads] update:', err)
    }
  },

  setStatus: async (id, status, byAdminId, reason) => {
    if (!isSupabaseConfigured) return
    const prev = get().byId(id)
    if (!prev) return
    if (prev.status === status) return

    const row: Record<string, unknown> = {
      status,
      last_activity_at: new Date().toISOString(),
    }
    if (status === 'lost' || status === 'won') {
      row.closed_at = new Date().toISOString()
      if (reason) row.closed_reason = reason
    } else {
      row.closed_at = null
      row.closed_reason = null
    }

    // Optimistic
    set((s) => ({ leads: s.leads.map((l) => l.id === id ? { ...l, status, closedReason: reason ?? l.closedReason } : l) }))

    try {
      const { error } = await supabase.from('leads').update(row).eq('id', id)
      if (error) console.error('[leads] setStatus:', error.message)
      await get().addEvent(id, 'status_change', byAdminId,
        `${prev.status} → ${status}${reason ? ` (${reason})` : ''}`,
        { from: prev.status, to: status, reason })
    } catch (err) {
      console.error('[leads] setStatus:', err)
    }
  },

  remove: async (id) => {
    if (!isSupabaseConfigured) return
    set((s) => ({ leads: s.leads.filter((l) => l.id !== id) }))
    try {
      const { error } = await supabase.from('leads').delete().eq('id', id)
      if (error) console.error('[leads] remove:', error.message)
    } catch (err) {
      console.error('[leads] remove:', err)
    }
  },

  addEvent: async (leadId, kind, byAdminId, body, data) => {
    if (!isSupabaseConfigured) return
    try {
      const { data: row, error } = await supabase.from('lead_events')
        .insert({
          lead_id: leadId,
          kind,
          by_admin_id: byAdminId ?? null,
          body: body ?? null,
          data: data ?? null,
        })
        .select()
        .single()
      if (error || !row) {
        console.warn('[leads] addEvent:', error?.message)
        return
      }
      get()._onEventInserted(eventFromRow(row as EventRow))
    } catch (err) {
      console.warn('[leads] addEvent:', err)
    }
  },

  // ─── Selectors ───
  byId: (id) => get().leads.find((l) => l.id === id),
  byEmail: (email) => {
    const e = email.trim().toLowerCase()
    return get().leads.find((l) => l.email?.toLowerCase() === e)
  },
  byStatus: (status) => get().leads.filter((l) => l.status === status),
  unassignedCount: () => get().leads.filter((l) => !l.assignedAdminId && l.status !== 'won' && l.status !== 'lost').length,
  myCount: (adminId) => get().leads.filter((l) => l.assignedAdminId === adminId && l.status !== 'won' && l.status !== 'lost').length,

  // ─── Realtime callbacks ───
  _onLeadInserted: (l) => {
    set((s) => {
      if (s.leads.some((x) => x.id === l.id)) return {}
      return { leads: [l, ...s.leads] }
    })
  },
  _onLeadUpdated: (l) => {
    set((s) => ({ leads: s.leads.map((x) => x.id === l.id ? l : x) }))
  },
  _onLeadDeleted: (id) => {
    set((s) => ({ leads: s.leads.filter((l) => l.id !== id) }))
  },
  _onEventInserted: (e) => {
    set((s) => {
      const next = new Map(s.eventsByLead)
      const existing = next.get(e.leadId) ?? []
      if (existing.some((x) => x.id === e.id)) return {}
      next.set(e.leadId, [e, ...existing])
      return { eventsByLead: next }
    })
  },
}))

function startRealtime() {
  if (!isSupabaseConfigured) return
  const channel = supabase.channel('leads:all')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
      useLeadsStore.getState()._onLeadInserted(leadFromRow(payload.new as LeadRow))
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
      useLeadsStore.getState()._onLeadUpdated(leadFromRow(payload.new as LeadRow))
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, (payload) => {
      const id = (payload.old as { id?: string }).id
      if (id) useLeadsStore.getState()._onLeadDeleted(id)
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_events' }, (payload) => {
      useLeadsStore.getState()._onEventInserted(eventFromRow(payload.new as EventRow))
    })
    .subscribe()
  void channel
}
