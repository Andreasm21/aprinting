// Right pane — auto-linked CRM context for the active thread.
// Shows whichever of {Customer, Lead, Quote/Document} the inbound webhook
// matched the sender to. Falls back to a "no linked records" state.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { User, Inbox, FileText, ExternalLink, AtSign } from 'lucide-react'
import { useEmailsStore } from '@/stores/emailsStore'
import { useCustomersStore } from '@/stores/customersStore'
import { useLeadsStore } from '@/stores/leadsStore'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

interface Props {
  threadId: string
}

interface DocumentSummary {
  id: string
  documentNumber: string
  type: string
  status: string
  total: number
  date: string
}

export default function ContextRail({ threadId }: Props) {
  const thread = useEmailsStore((s) => s.byId(threadId))
  const customers = useCustomersStore((s) => s.customers)
  const leads = useLeadsStore((s) => s.leads)
  const customer = useMemo(
    () => (thread?.customerId ? customers.find((c) => c.id === thread.customerId) : null),
    [customers, thread?.customerId],
  )
  const lead = useMemo(
    () => (thread?.leadId ? leads.find((l) => l.id === thread.leadId) : null),
    [leads, thread?.leadId],
  )

  // Document is loaded on demand because invoicesStore loading may be expensive
  const [doc, setDoc] = useState<DocumentSummary | null>(null)
  useEffect(() => {
    if (!thread?.documentId || !isSupabaseConfigured) { setDoc(null); return }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('documents')
        .select('id, document_number, type, status, total, date')
        .eq('id', thread.documentId!)
        .maybeSingle()
      if (cancelled || !data) return
      setDoc({
        id: data.id,
        documentNumber: data.document_number,
        type: data.type,
        status: data.status,
        total: typeof data.total === 'string' ? parseFloat(data.total) : data.total,
        date: data.date,
      })
    })()
    return () => { cancelled = true }
  }, [thread?.documentId])

  if (!thread) return null

  const hasAnyLinks = customer || lead || doc

  return (
    <div className="card-base flex flex-col h-full overflow-hidden font-mono">
      <div className="px-3 py-2 border-b border-border bg-bg-tertiary/40">
        <p className="text-[10px] uppercase tracking-wider text-text-muted">Context</p>
        <p className="text-text-primary text-xs font-bold truncate">{thread.participantName ?? thread.participantEmail}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {/* Sender always shown */}
        <Section title="Sender" icon={AtSign}>
          <p className="text-text-primary font-medium truncate">{thread.participantName ?? '—'}</p>
          <a
            href={`mailto:${thread.participantEmail}`}
            className="text-accent-amber hover:underline text-[11px] block truncate mt-0.5"
          >
            {thread.participantEmail}
          </a>
        </Section>

        {/* Customer */}
        {customer && (
          <Section title="Customer" icon={User} accent="emerald">
            <p className="text-text-primary font-medium">{customer.name}</p>
            {customer.company && <p className="text-text-muted text-[11px]">{customer.company}</p>}
            <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
              <div>
                <p className="text-text-muted uppercase tracking-wider">Orders</p>
                <p className="text-text-primary font-bold">{customer.totalOrders}</p>
              </div>
              <div>
                <p className="text-text-muted uppercase tracking-wider">Lifetime</p>
                <p className="text-text-primary font-bold">€{customer.totalSpent.toFixed(0)}</p>
              </div>
            </div>
            <Link
              to={`/admin/customers/${customer.id}`}
              className="mt-2 text-[10px] text-accent-amber hover:underline flex items-center gap-1"
            >
              Open profile <ExternalLink size={9} />
            </Link>
          </Section>
        )}

        {/* Lead */}
        {lead && (
          <Section title="Lead" icon={Inbox} accent="amber">
            <p className="text-text-primary font-medium">{lead.name}</p>
            <p className="text-text-muted text-[11px] uppercase tracking-wider mt-0.5">
              {lead.status}{lead.scopeDescription ? ` · ${lead.scopeDescription.slice(0, 40)}${lead.scopeDescription.length > 40 ? '…' : ''}` : ''}
            </p>
            <Link
              to="/admin/leads"
              className="mt-2 text-[10px] text-accent-amber hover:underline flex items-center gap-1"
            >
              Open in pipeline <ExternalLink size={9} />
            </Link>
          </Section>
        )}

        {/* Document */}
        {doc && (
          <Section title="Latest quote / invoice" icon={FileText} accent="violet">
            <p className="text-text-primary font-medium">{doc.documentNumber}</p>
            <p className="text-text-muted text-[11px] uppercase tracking-wider mt-0.5">
              {doc.type} · {doc.status} · €{doc.total.toFixed(2)}
            </p>
            <p className="text-text-muted text-[10px] mt-0.5">
              {new Date(doc.date).toLocaleDateString()}
            </p>
            <Link
              to={doc.type === 'quotation' ? '/admin/orders/quotations' : '/admin/orders/invoices'}
              className="mt-2 text-[10px] text-accent-amber hover:underline flex items-center gap-1"
            >
              Open document <ExternalLink size={9} />
            </Link>
          </Section>
        )}

        {!hasAnyLinks && (
          <div className="text-text-muted text-[11px] italic text-center py-6">
            No customer / lead / quote linked yet.<br />
            They'll appear here once a record matches the sender's email.
          </div>
        )}
      </div>
    </div>
  )
}

function Section({
  title, icon: Icon, accent, children,
}: { title: string; icon: React.ComponentType<{ size?: number; className?: string }>; accent?: 'emerald' | 'amber' | 'violet'; children: React.ReactNode }) {
  const tone = accent === 'emerald' ? 'border-emerald-500/30'
    : accent === 'amber' ? 'border-amber-500/30'
    : accent === 'violet' ? 'border-violet-500/30'
    : 'border-border'
  return (
    <div className={`rounded-lg border ${tone} bg-bg-tertiary/30 p-3`}>
      <p className="text-[9px] uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1">
        <Icon size={9} /> {title}
      </p>
      {children}
    </div>
  )
}
