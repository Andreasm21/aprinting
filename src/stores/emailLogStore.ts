// Tracks every email sent through /api/send-email — Supabase-backed.
// Powers the AdminEmails history table.

import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export type EmailStatus = 'sent' | 'failed'
export type EmailTemplate = 'invoice' | 'quotation' | 'portal_credentials' | 'custom'

export interface EmailLogEntry {
  id: string
  to: string[]
  cc?: string[]
  subject: string
  template?: EmailTemplate | string
  documentId?: string
  customerId?: string
  status: EmailStatus
  error?: string
  sentBy?: string
  sentAt: string
}

interface SbRow {
  id: string
  to_emails: string[] | string  // jsonb
  cc_emails: string[] | string | null
  subject: string
  template: string | null
  document_id: string | null
  customer_id: string | null
  status: string
  error: string | null
  sent_by: string | null
  sent_at: string | null
}

function rowToEntry(r: SbRow): EmailLogEntry {
  const parseJsonb = (v: unknown): string[] | undefined => {
    if (!v) return undefined
    if (Array.isArray(v)) return v as string[]
    if (typeof v === 'string') {
      try { const j = JSON.parse(v); return Array.isArray(j) ? j : [v] } catch { return [v] }
    }
    return undefined
  }
  return {
    id: r.id,
    to: parseJsonb(r.to_emails) || [],
    cc: parseJsonb(r.cc_emails),
    subject: r.subject,
    template: r.template ?? undefined,
    documentId: r.document_id ?? undefined,
    customerId: r.customer_id ?? undefined,
    status: (r.status as EmailStatus) || 'sent',
    error: r.error ?? undefined,
    sentBy: r.sent_by ?? undefined,
    sentAt: r.sent_at || new Date().toISOString(),
  }
}

function entryToRow(e: EmailLogEntry): Record<string, unknown> {
  return {
    id: e.id,
    to_emails: e.to,
    cc_emails: e.cc ?? null,
    subject: e.subject,
    template: e.template ?? null,
    document_id: e.documentId ?? null,
    customer_id: e.customerId ?? null,
    status: e.status,
    error: e.error ?? null,
    sent_by: e.sentBy ?? null,
    sent_at: e.sentAt,
  }
}

interface EmailLogState {
  entries: EmailLogEntry[]
  loading: boolean
  log: (entry: Omit<EmailLogEntry, 'id' | 'sentAt'>) => Promise<string>
}

async function fetchFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured) {
    useEmailLogStore.setState({ loading: false })
    return
  }
  useEmailLogStore.setState({ loading: true })
  try {
    const { data, error } = await supabase
      .from('email_log')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(500)
    if (error) {
      console.error('[email_log] fetch error:', error)
      useEmailLogStore.setState({ loading: false })
      return
    }
    const entries = (data || []).map(rowToEntry)
    useEmailLogStore.setState({ entries, loading: false })
  } catch (err) {
    console.error('[email_log] fetch exception:', err)
    useEmailLogStore.setState({ loading: false })
  }
}

async function sbInsert(entry: EmailLogEntry): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('email_log').insert(entryToRow(entry))
    if (error) console.error('[email_log] insert error:', error)
  } catch (err) {
    console.error('[email_log] insert exception:', err)
  }
}

export const useEmailLogStore = create<EmailLogState>((set) => {
  return {
    entries: [],
    loading: true,
    log: async (data) => {
      const id = `mail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const entry: EmailLogEntry = { ...data, id, sentAt: new Date().toISOString() }
      set((state) => ({ entries: [entry, ...state.entries] }))
      await sbInsert(entry)
      return id
    },
  }
})

// Kick off initial Supabase fetch AFTER the store is fully assigned (avoids TDZ).
void fetchFromSupabase()
