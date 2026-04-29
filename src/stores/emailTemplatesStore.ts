// Saved-replies / email-template store. Each template has an HTML body,
// optional subject override, optional admin-scope (NULL = team-wide), and
// supports `{{customer.name}}`-style variable substitution at insert time.
//
// Phase 5 of the mail-client build wires this into the composer. Phase 1
// just stores them; templates UI comes next.

import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface EmailTemplate {
  id: string
  name: string
  subject?: string
  bodyHtml: string
  scopeAdminId?: string         // NULL = team-wide
  createdBy: string
  createdAt: string
}

interface TemplateRow {
  id: string
  name: string
  subject: string | null
  body_html: string
  scope_admin_id: string | null
  created_by: string
  created_at: string
}

function fromRow(r: TemplateRow): EmailTemplate {
  return {
    id: r.id,
    name: r.name,
    subject: r.subject ?? undefined,
    bodyHtml: r.body_html,
    scopeAdminId: r.scope_admin_id ?? undefined,
    createdBy: r.created_by,
    createdAt: r.created_at,
  }
}

let _warned = false
let _realtimeStarted = false

interface State {
  templates: EmailTemplate[]
  loading: boolean
  hasLoaded: boolean
  schemaMissing: boolean

  load: () => Promise<void>
  create: (input: {
    name: string
    subject?: string
    bodyHtml: string
    scopeAdminId?: string
    createdBy: string
  }) => Promise<EmailTemplate | null>
  update: (id: string, updates: Partial<Pick<EmailTemplate, 'name' | 'subject' | 'bodyHtml' | 'scopeAdminId'>>) => Promise<void>
  remove: (id: string) => Promise<void>

  // Selectors
  forAdmin: (adminId: string) => EmailTemplate[]
  byId: (id: string) => EmailTemplate | undefined

  // Internal
  _onInserted: (t: EmailTemplate) => void
  _onUpdated: (t: EmailTemplate) => void
  _onDeleted: (id: string) => void
}

export const useEmailTemplatesStore = create<State>((set, get) => ({
  templates: [],
  loading: false,
  hasLoaded: false,
  schemaMissing: false,

  load: async () => {
    if (!isSupabaseConfigured) { set({ hasLoaded: true }); return }
    if (get().loading || get().hasLoaded) return
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        const code = (error as { code?: string }).code
        const tableMissing = code === '42P01' || code === 'PGRST205' ||
          /Could not find the table/i.test(error.message ?? '') ||
          /relation .* does not exist/i.test(error.message ?? '')
        if (tableMissing) {
          if (!_warned) {
            _warned = true
            console.info('[email_templates] table not found — apply supabase/migrations/20260429_mail_client.sql')
          }
          set({ loading: false, hasLoaded: true, schemaMissing: true })
          return
        }
        console.error('[email_templates] load:', error.message)
        set({ loading: false, hasLoaded: true })
        return
      }
      set({ templates: ((data ?? []) as TemplateRow[]).map(fromRow), loading: false, hasLoaded: true })
      if (!_realtimeStarted) {
        _realtimeStarted = true
        startRealtime()
      }
    } catch (err) {
      console.error('[email_templates] load:', err)
      set({ loading: false, hasLoaded: true })
    }
  },

  create: async (input) => {
    if (!isSupabaseConfigured || get().schemaMissing) return null
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          name: input.name.trim(),
          subject: input.subject?.trim() || null,
          body_html: input.bodyHtml,
          scope_admin_id: input.scopeAdminId ?? null,
          created_by: input.createdBy,
        })
        .select()
        .single()
      if (error || !data) {
        console.error('[email_templates] create:', error?.message)
        return null
      }
      const tmpl = fromRow(data as TemplateRow)
      get()._onInserted(tmpl)
      return tmpl
    } catch (err) {
      console.error('[email_templates] create:', err)
      return null
    }
  },

  update: async (id, updates) => {
    if (!isSupabaseConfigured) return
    const row: Record<string, unknown> = {}
    if (updates.name != null) row.name = updates.name
    if ('subject' in updates) row.subject = updates.subject ?? null
    if (updates.bodyHtml != null) row.body_html = updates.bodyHtml
    if ('scopeAdminId' in updates) row.scope_admin_id = updates.scopeAdminId ?? null

    set((s) => ({ templates: s.templates.map((t) => t.id === id ? { ...t, ...updates } : t) }))

    try {
      const { error } = await supabase.from('email_templates').update(row).eq('id', id)
      if (error) console.error('[email_templates] update:', error.message)
    } catch (err) {
      console.error('[email_templates] update:', err)
    }
  },

  remove: async (id) => {
    if (!isSupabaseConfigured) return
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }))
    try {
      const { error } = await supabase.from('email_templates').delete().eq('id', id)
      if (error) console.error('[email_templates] remove:', error.message)
    } catch (err) {
      console.error('[email_templates] remove:', err)
    }
  },

  forAdmin: (adminId) => get().templates.filter((t) => !t.scopeAdminId || t.scopeAdminId === adminId),
  byId: (id) => get().templates.find((t) => t.id === id),

  _onInserted: (t) => {
    set((s) => {
      if (s.templates.some((x) => x.id === t.id)) return {}
      return { templates: [t, ...s.templates] }
    })
  },
  _onUpdated: (t) => {
    set((s) => ({ templates: s.templates.map((x) => x.id === t.id ? t : x) }))
  },
  _onDeleted: (id) => {
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }))
  },
}))

function startRealtime() {
  if (!isSupabaseConfigured) return
  const channel = supabase.channel('email_templates:all')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_templates' }, (payload) => {
      useEmailTemplatesStore.getState()._onInserted(fromRow(payload.new as TemplateRow))
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'email_templates' }, (payload) => {
      useEmailTemplatesStore.getState()._onUpdated(fromRow(payload.new as TemplateRow))
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'email_templates' }, (payload) => {
      const id = (payload.old as { id?: string }).id
      if (id) useEmailTemplatesStore.getState()._onDeleted(id)
    })
    .subscribe()
  void channel
}
