// Public-facing order tracking at /track/:orderId — no login required.
// Customer sees: order number, status timeline, linked invoice with
// download button. Mirrors the admin order profile but stripped down.

import { useMemo, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Lock, AlertCircle, ArrowRight, Download, Loader2, Check, Circle, MessageSquare,
  Package, Truck, Sparkles, ClipboardList, Clock, X as XIcon,
} from 'lucide-react'
import { useOrdersStore, ORDER_STATUS_LABEL, type OrderStatus, type OrderEvent } from '@/stores/ordersStore'
import { useInvoicesStore } from '@/stores/invoicesStore'
import { elementToPdfBase64 } from '@/lib/emailClient'

const STATUS_ICON: Record<OrderStatus, typeof Package> = {
  pending: Clock,
  in_production: Sparkles,
  ready: Package,
  shipped: Truck,
  delivered: Check,
  closed: ClipboardList,
  cancelled: XIcon,
}

const STATUS_TINT: Record<OrderStatus, string> = {
  pending: 'text-accent-amber bg-accent-amber/10 border-accent-amber/30',
  in_production: 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
  ready: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  shipped: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  delivered: 'text-accent-green bg-accent-green/10 border-accent-green/30',
  closed: 'text-text-muted bg-bg-tertiary border-border',
  cancelled: 'text-red-400 bg-red-500/10 border-red-500/30',
}

const PIPELINE: OrderStatus[] = ['pending', 'in_production', 'ready', 'shipped', 'delivered']

const EVENT_LABEL: Record<string, string> = {
  quotation_sent: 'Quotation sent',
  quotation_accepted: 'Quotation accepted',
  order_created: 'Order created',
  invoice_generated: 'Invoice issued',
  status_changed: 'Status updated',
  note_added: 'Update from Axiom',
}

function describeEvent(e: OrderEvent): string {
  switch (e.type) {
    case 'status_changed':
      return `Now ${e.toStatus ? ORDER_STATUS_LABEL[e.toStatus] : '—'}`
    case 'invoice_generated':
      return e.invoiceNumber ? `Invoice ${e.invoiceNumber}` : 'Invoice issued'
    case 'quotation_sent':
    case 'quotation_accepted':
      return e.quotationNumber ? `Quotation ${e.quotationNumber}` : EVENT_LABEL[e.type]
    case 'note_added':
      return e.note || 'Note from Axiom'
    default:
      return EVENT_LABEL[e.type] || e.type
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function PublicOrderTracking() {
  const { id } = useParams<{ id: string }>()
  const orders = useOrdersStore((s) => s.orders)
  const ordersLoading = useOrdersStore((s) => s.loading)
  const invoices = useInvoicesStore((s) => s.invoices)
  const order = useMemo(() => orders.find((o) => o.id === id), [orders, id])
  const invoice = useMemo(
    () => (order?.invoiceId ? invoices.find((i) => i.id === order.invoiceId) : undefined),
    [order, invoices],
  )
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const printableRef = useRef<HTMLDivElement>(null)

  if (ordersLoading) {
    return <PageShell><div className="text-center text-text-muted font-mono py-20">Loading order…</div></PageShell>
  }

  if (!order) {
    return (
      <PageShell>
        <div className="card-base p-10 text-center max-w-lg mx-auto">
          <AlertCircle size={36} className="mx-auto text-text-muted/40 mb-4" />
          <h2 className="font-mono text-lg text-text-primary mb-2">Order not found</h2>
          <p className="text-text-secondary text-sm">This tracking link may be invalid or the order has been archived.</p>
          <Link to="/" className="inline-block mt-6 text-accent-amber font-mono text-sm hover:underline">← Back to axiomcreate.com</Link>
        </div>
      </PageShell>
    )
  }

  const handleDownload = async () => {
    if (!invoice) {
      setError('Invoice not yet attached to this order.')
      return
    }
    setDownloading(true)
    setError(null)
    try {
      if (!printableRef.current) {
        setError('Could not render the invoice. Refresh and try again.')
        return
      }
      const att = await elementToPdfBase64(printableRef.current, invoice.documentNumber)
      // base64 → blob → trigger download
      const bin = atob(att.content)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      const blob = new Blob([arr], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = att.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate PDF')
    } finally {
      setDownloading(false)
    }
  }

  const isCancelled = order.status === 'cancelled'
  const currentIdx = PIPELINE.indexOf(order.status)

  return (
    <PageShell>
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Order tracking</p>
        <h1 className="font-mono text-3xl font-bold text-accent-amber mt-1">{order.orderNumber}</h1>
        <p className="text-text-secondary text-sm mt-2">Hi {order.customerName?.split(' ')[0] || 'there'} — here's where your order stands.</p>
      </div>

      {/* Progress pipeline */}
      {!isCancelled ? (
        <div className="mb-8">
          <div className="flex items-center justify-between gap-2 mb-3">
            {PIPELINE.map((s, i) => {
              const Icon = STATUS_ICON[s]
              const reached = currentIdx >= i
              const isCurrent = currentIdx === i
              return (
                <div key={s} className="flex-1 flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                    reached ? `${STATUS_TINT[s]} ${isCurrent ? 'animate-pulse' : ''}` : 'border-border bg-bg-tertiary text-text-muted'
                  }`}>
                    <Icon size={16} />
                  </div>
                  <p className={`text-[10px] font-mono uppercase mt-2 text-center ${reached ? 'text-text-primary' : 'text-text-muted'}`}>
                    {ORDER_STATUS_LABEL[s]}
                  </p>
                </div>
              )
            })}
          </div>
          {/* Connector line */}
          <div className="relative h-0.5 bg-border -mt-12 mb-12 mx-12 z-0">
            <div className="absolute inset-y-0 left-0 bg-accent-amber transition-all" style={{ width: `${Math.max(0, (currentIdx / (PIPELINE.length - 1)) * 100)}%` }} />
          </div>
        </div>
      ) : (
        <div className="card-base bg-red-500/5 border-red-500/30 p-4 mb-8 text-center">
          <p className="font-mono text-sm text-red-400 font-bold">Order cancelled</p>
          <p className="text-text-secondary text-xs mt-1">If this is unexpected, please reach out.</p>
        </div>
      )}

      {/* Status badge + total */}
      <div className="card-base p-5 mb-6 grid sm:grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] font-mono uppercase text-text-muted">Status</p>
          <span className={`inline-block text-[11px] font-mono uppercase px-3 py-1 rounded border mt-1 ${STATUS_TINT[order.status]}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase text-text-muted">Total</p>
          <p className="font-mono text-lg font-bold text-accent-amber mt-1">€{order.total.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase text-text-muted">Order date</p>
          <p className="text-text-primary text-sm mt-1">{new Date(order.createdAt).toLocaleDateString('en-GB')}</p>
        </div>
      </div>

      {/* Invoice card */}
      {invoice && (
        <div className="card-base p-5 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase text-text-muted">Invoice</p>
            <p className="font-mono text-sm font-bold text-text-primary mt-1">{invoice.documentNumber}</p>
            <p className="text-text-muted text-xs mt-0.5">€{(invoice.totalOverride ?? invoice.total).toFixed(2)} · {invoice.status === 'paid' ? 'Paid' : invoice.status === 'sent' ? 'Sent' : 'Issued'}</p>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="btn-amber py-2.5 px-4 flex items-center gap-2 disabled:opacity-50"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {downloading ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      )}

      {error && (
        <div className="card-base bg-red-500/5 border-red-500/30 p-3 mb-6 text-xs font-mono text-red-400 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Timeline */}
      <div className="card-base p-5 mb-6">
        <h3 className="font-mono text-xs uppercase text-text-muted mb-4">Timeline</h3>
        <div className="space-y-3 relative">
          <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
          {[...order.history].reverse().map((e, i) => (
            <div key={i} className="flex items-start gap-3 relative">
              <div className="w-4 h-4 rounded-full bg-bg-secondary border-2 border-accent-amber shrink-0 mt-0.5 z-10 flex items-center justify-center">
                {e.type === 'quotation_accepted' || e.type === 'invoice_generated' ? (
                  <Check size={9} className="text-accent-amber" />
                ) : e.type === 'note_added' ? (
                  <MessageSquare size={9} className="text-text-muted" />
                ) : (
                  <Circle size={6} className="text-accent-amber fill-accent-amber" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-primary font-mono">{EVENT_LABEL[e.type] || e.type}</p>
                <p className="text-[11px] text-text-muted">{describeEvent(e)}</p>
                <p className="text-[10px] text-text-muted mt-0.5">{formatDate(e.date)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-text-muted text-xs font-mono text-center">
        Questions? <a href="mailto:team@axiomcreate.com" className="text-accent-amber hover:underline">team@axiomcreate.com</a>
      </p>

      {/* Hidden printable invoice for PDF generation */}
      {invoice && (
        <div className="absolute -left-[10000px] top-0 pointer-events-none">
          <div ref={printableRef} className="bg-white rounded-lg max-w-3xl w-full mx-auto p-8 text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="flex items-baseline gap-0">
                  <span className="text-2xl font-bold" style={{ color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>A</span>
                  <span className="text-2xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>xiom</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Professional 3D Printing Services</p>
                <p className="text-xs text-gray-500">team@axiomcreate.com</p>
              </div>
              <div className="text-right">
                <h1 className="text-xl font-bold uppercase tracking-wider" style={{ color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>Invoice</h1>
                <p className="text-sm font-mono text-gray-700 mt-1">{invoice.documentNumber}</p>
                <p className="text-xs text-gray-500 mt-2">Date: {new Date(invoice.date).toLocaleDateString('en-GB')}</p>
              </div>
            </div>
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1 font-bold">Bill To</p>
              <p className="text-sm font-semibold">{invoice.customerName}</p>
              <p className="text-xs text-gray-500">{invoice.customerEmail}</p>
            </div>
            <div className="flex justify-between pt-4 border-t-2 font-bold text-base" style={{ borderColor: '#F59E0B' }}>
              <span>Total (EUR)</span>
              <span>{(invoice.totalOverride ?? invoice.total).toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-gray-500 text-right pt-1">
              {invoice.vatRate > 0 ? `Inclusive of Cyprus VAT ${(invoice.vatRate * 100).toFixed(0)}%` : 'VAT not included'}
            </p>
            <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-center text-xs text-gray-400 gap-1">
              <span>Powered by</span>
              <span className="font-mono font-bold" style={{ color: '#F59E0B' }}>Axiom</span>
              <ArrowRight size={11} />
              <span>axiomcreate.com</span>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="border-b border-border bg-bg-secondary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="font-mono text-2xl font-bold flex items-baseline">
            <span className="text-accent-amber">A</span><span>xiom</span>
          </Link>
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted flex items-center gap-1">
            <Lock size={10} /> Secure tracking
          </span>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
    </div>
  )
}
