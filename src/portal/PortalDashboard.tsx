import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Receipt, Clock, CreditCard } from 'lucide-react'
import { usePortalAuthStore } from '@/stores/portalAuthStore'
import { useInvoicesStore, type DocumentStatus } from '@/stores/invoicesStore'

const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: 'text-text-muted border-border',
  sent: 'text-accent-blue border-accent-blue/30 bg-accent-blue/5',
  paid: 'text-accent-green border-accent-green/30 bg-accent-green/5',
  cancelled: 'text-red-400 border-red-400/30 bg-red-400/5',
}

export default function PortalDashboard() {
  const customer = usePortalAuthStore((s) => s.customer)
  const invoices = useInvoicesStore((s) => s.invoices)

  const customerDocs = useMemo(() => {
    if (!customer) return []
    return invoices
      .filter((inv) => inv.customerId === customer.id || inv.customerEmail === customer.email)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [invoices, customer])

  const stats = useMemo(() => {
    const quotes = customerDocs.filter((d) => d.type === 'quotation')
    const invs = customerDocs.filter((d) => d.type === 'invoice')
    const pending = invs.filter((i) => i.status === 'sent' || i.status === 'draft')
    const totalPaid = invs.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)
    return {
      quotations: quotes.length,
      invoices: invs.length,
      pending: pending.length,
      totalPaid,
    }
  }, [customerDocs])

  const recentDocs = customerDocs.slice(0, 5)

  return (
    <div>
      <h1 className="font-mono text-2xl font-bold text-text-primary mb-1">
        Welcome, {customer?.name.split(' ')[0]}
      </h1>
      <p className="text-text-secondary text-sm mb-8">
        {customer?.company && <span className="text-text-muted">{customer.company} · </span>}
        Here's your account overview.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Quotations', value: stats.quotations, icon: FileText, color: 'text-accent-blue' },
          { label: 'Invoices', value: stats.invoices, icon: Receipt, color: 'text-accent-amber' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: stats.pending > 0 ? 'text-accent-amber' : 'text-text-muted' },
          { label: 'Total Paid', value: `€${stats.totalPaid.toFixed(2)}`, icon: CreditCard, color: 'text-accent-green' },
        ].map((s) => (
          <div key={s.label} className="card-base p-4 text-center">
            <s.icon size={18} className={`mx-auto mb-2 ${s.color}`} />
            <div className={`font-mono text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-text-muted uppercase font-mono">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent documents */}
      <div className="card-base p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-sm font-bold text-text-primary flex items-center gap-2">
            <Clock size={14} className="text-accent-amber" /> Recent Documents
          </h2>
          <Link to="/portal/documents" className="text-xs font-mono text-accent-amber hover:underline">
            View all
          </Link>
        </div>

        {recentDocs.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-6 font-mono">No documents yet</p>
        ) : (
          <div className="space-y-1">
            {recentDocs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-bg-tertiary/50 transition-colors">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  doc.type === 'invoice' ? 'bg-accent-amber/10 text-accent-amber' : 'bg-accent-blue/10 text-accent-blue'
                }`}>
                  {doc.type === 'invoice' ? <Receipt size={12} /> : <FileText size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-accent-amber">{doc.documentNumber}</span>
                    <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[doc.status]}`}>
                      {doc.status === 'paid' && doc.type === 'quotation' ? 'accepted' : doc.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    {new Date(doc.date).toLocaleDateString('en-GB')} · {doc.lineItems[0]?.description || 'Document'}
                  </p>
                </div>
                <span className="font-mono text-sm text-text-primary">€{doc.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
