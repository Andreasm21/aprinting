import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronDown, ClipboardList, FileText, Receipt, User, Calendar,
  CheckCircle2, Circle, MessageSquare, Link as LinkIcon, Copy, Check, Mail, Loader2,
} from 'lucide-react'
import { useOrdersStore, ORDER_STATUS_FLOW, ORDER_STATUS_LABEL, type OrderStatus, type OrderEvent } from '@/stores/ordersStore'
import { useInvoicesStore } from '@/stores/invoicesStore'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useCustomersStore } from '@/stores/customersStore'
import { useEmailLogStore } from '@/stores/emailLogStore'
import { sendEmail } from '@/lib/emailClient'
import { orderTrackingEmail } from '@/lib/emailTemplates'
import DocumentPreview from '../components/DocumentPreview'

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'text-accent-amber bg-accent-amber/10 border-accent-amber/30',
  in_production: 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
  ready: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  shipped: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  delivered: 'text-accent-green bg-accent-green/10 border-accent-green/30',
  closed: 'text-text-muted bg-bg-tertiary border-border',
  cancelled: 'text-red-400 bg-red-500/10 border-red-500/30',
}

const EVENT_LABEL: Record<string, string> = {
  quotation_sent: 'Quotation sent',
  quotation_accepted: 'Quotation accepted',
  order_created: 'Order created',
  invoice_generated: 'Invoice generated',
  status_changed: 'Status updated',
  note_added: 'Note added',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

function describeEvent(e: OrderEvent): string {
  switch (e.type) {
    case 'status_changed':
      return `${e.fromStatus ? ORDER_STATUS_LABEL[e.fromStatus] : '—'} → ${e.toStatus ? ORDER_STATUS_LABEL[e.toStatus] : '—'}`
    case 'invoice_generated':
      return e.invoiceNumber ? `Invoice ${e.invoiceNumber}` : 'Invoice generated'
    case 'quotation_sent':
    case 'quotation_accepted':
      return e.quotationNumber ? `Quotation ${e.quotationNumber}` : EVENT_LABEL[e.type]
    case 'note_added':
      return e.note || 'Note'
    default:
      return EVENT_LABEL[e.type] || e.type
  }
}

export default function AdminOrderProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const order = useOrdersStore((s) => (id ? s.getOrderById(id) : undefined))
  const changeStatus = useOrdersStore((s) => s.changeStatus)
  const appendEvent = useOrdersStore((s) => s.appendEvent)
  const invoices = useInvoicesStore((s) => s.invoices)
  const currentUser = useAdminAuthStore((s) => s.currentUser)

  const [previewDocId, setPreviewDocId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [emailNote, setEmailNote] = useState('')
  const customers = useCustomersStore((s) => s.customers)
  const logEmail = useEmailLogStore((s) => s.log)

  if (!order) {
    return (
      <div className="card-base p-10 text-center">
        <p className="text-text-muted text-sm font-mono">[ ORDER NOT FOUND ]</p>
        <Link to="/admin/orders" className="inline-block mt-4 text-accent-amber text-xs font-mono hover:underline">← Back to orders</Link>
      </div>
    )
  }

  const quote = order.quotationId ? invoices.find((i) => i.id === order.quotationId) : undefined
  const invoice = order.invoiceId ? invoices.find((i) => i.id === order.invoiceId) : undefined
  const previewDoc = previewDocId ? invoices.find((i) => i.id === previewDocId) : undefined

  const handleStatusChange = async (to: OrderStatus) => {
    if (to === order.status) return
    await changeStatus(order.id, to, currentUser?.username)
  }

  const handleAddNote = async () => {
    if (!noteDraft.trim()) return
    await appendEvent(order.id, { type: 'note_added', by: currentUser?.username, note: noteDraft.trim() })
    setNoteDraft('')
  }

  // Resolve customer email — check by id, then by linked invoice's customerEmail
  // (orders sometimes don't carry customerId for legacy reasons).
  const resolvedEmail = (() => {
    if (order.customerId) {
      const c = customers.find((c) => c.id === order.customerId)
      if (c) return c.email
    }
    if (invoice?.customerEmail) return invoice.customerEmail
    if (quote?.customerEmail) return quote.customerEmail
    return ''
  })()

  const handleSendTracking = async () => {
    if (!resolvedEmail) {
      setSendResult({ ok: false, msg: 'No customer email on file for this order.' })
      return
    }
    setSending(true)
    setSendResult(null)
    const trackingUrl = `${window.location.origin}/track/${order.id}`
    const tmpl = orderTrackingEmail({
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      statusLabel: ORDER_STATUS_LABEL[order.status],
      total: order.total,
      vatRate: invoice?.vatRate ?? 0,
      trackingUrl,
      noteFromAdmin: emailNote.trim() || undefined,
    })
    const res = await sendEmail({
      to: resolvedEmail,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    })
    await logEmail({
      to: [resolvedEmail],
      subject: tmpl.subject,
      template: 'custom',
      documentId: order.invoiceId,
      customerId: order.customerId,
      status: res.success ? 'sent' : 'failed',
      error: res.error,
      sentBy: currentUser?.username,
    })
    if (res.success) {
      // Log to the order timeline so future-you knows what was emailed.
      await appendEvent(order.id, {
        type: 'note_added',
        by: currentUser?.username || 'admin',
        note: `Tracking link emailed to ${resolvedEmail}${emailNote.trim() ? ` with note: "${emailNote.trim()}"` : ''}`,
      })
    }
    setSendResult({
      ok: res.success,
      msg: res.success
        ? `Tracking link sent to ${resolvedEmail}`
        : `Failed: ${res.error || 'unknown'}`,
    })
    setSending(false)
    if (res.success) {
      setEmailNote('')
      setTimeout(() => { setShowSendModal(false); setSendResult(null) }, 1500)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-mono text-text-muted hover:text-text-primary">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-mono uppercase px-3 py-1 rounded border ${STATUS_STYLE[order.status]}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
          <div className="relative">
            <select
              value={order.status}
              onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
              className="input-field text-xs font-mono pr-8 appearance-none"
            >
              {[...ORDER_STATUS_FLOW, 'cancelled' as OrderStatus].map((s) => (
                <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="font-mono text-3xl font-bold text-accent-amber flex items-center gap-3">
          <ClipboardList size={28} /> {order.orderNumber}
        </h1>

        {/* Public tracking link — copy & share with the customer */}
        <div className="card-base bg-accent-blue/5 border-accent-blue/30 p-3 mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <LinkIcon size={14} className="text-accent-blue shrink-0" />
            <code className="font-mono text-xs text-text-secondary truncate">{`${window.location.origin}/track/${order.id}`}</code>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <button
              onClick={() => setShowSendModal(true)}
              disabled={!resolvedEmail}
              className="text-xs font-mono text-accent-amber hover:text-accent-amber/80 px-3 py-1.5 rounded-lg border border-accent-amber/40 hover:bg-accent-amber/10 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              title={resolvedEmail ? `Email this link to ${resolvedEmail}` : 'No customer email on file'}
            >
              <Mail size={12} /> Send by email
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/track/${order.id}`
                navigator.clipboard.writeText(url)
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 1500)
              }}
              className="text-xs font-mono text-accent-blue hover:text-accent-blue/80 px-3 py-1.5 rounded-lg border border-accent-blue/40 hover:bg-accent-blue/10 flex items-center gap-1.5"
            >
              {linkCopied ? <Check size={12} /> : <Copy size={12} />}
              {linkCopied ? 'Copied' : 'Copy link'}
            </button>
            <a
              href={`/track/${order.id}`}
              target="_blank"
              rel="noopener"
              className="text-xs font-mono text-text-muted hover:text-text-primary px-3 py-1.5 rounded-lg border border-border hover:bg-bg-tertiary flex items-center gap-1.5"
            >
              Open
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-text-muted text-xs font-mono">
          <span className="flex items-center gap-1"><User size={12} /> {order.customerName}</span>
          <span className="flex items-center gap-1"><Calendar size={12} /> Created {formatDateTime(order.createdAt)}</span>
          <span>Total: <span className="text-accent-amber font-bold">€{order.total.toFixed(2)}</span></span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left — linked documents + customer */}
        <div className="lg:col-span-2 space-y-4">
          {quote && (
            <div className="card-base p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-accent-blue" />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase text-text-muted">Quotation</p>
                    <p className="font-mono text-sm font-bold text-text-primary">{quote.documentNumber}</p>
                    <p className="text-text-muted text-xs mt-1">€{(quote.totalOverride ?? quote.total).toFixed(2)} · {new Date(quote.date).toLocaleDateString('en-GB')}</p>
                  </div>
                </div>
                <button onClick={() => setPreviewDocId(quote.id)} className="btn-outline text-xs py-1.5 px-3">
                  Preview
                </button>
              </div>
            </div>
          )}

          {invoice ? (
            <div className="card-base p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded bg-accent-amber/10 border border-accent-amber/30 flex items-center justify-center shrink-0">
                    <Receipt size={18} className="text-accent-amber" />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase text-text-muted">Invoice</p>
                    <p className="font-mono text-sm font-bold text-text-primary">{invoice.documentNumber}</p>
                    <p className="text-text-muted text-xs mt-1">€{(invoice.totalOverride ?? invoice.total).toFixed(2)} · {invoice.status.toUpperCase()}</p>
                  </div>
                </div>
                <button onClick={() => setPreviewDocId(invoice.id)} className="btn-outline text-xs py-1.5 px-3">
                  Preview
                </button>
              </div>
            </div>
          ) : (
            <div className="card-base p-4 border-dashed">
              <p className="text-text-muted text-xs font-mono">No invoice yet</p>
            </div>
          )}

          {/* Add note */}
          <div className="card-base p-4">
            <p className="text-[10px] font-mono uppercase text-text-muted mb-2">Add a note to this order</p>
            <div className="flex gap-2">
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="e.g. customer requested expedited shipping"
                className="input-field text-sm flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              />
              <button onClick={handleAddNote} disabled={!noteDraft.trim()} className="btn-amber text-xs py-1.5 px-4 disabled:opacity-40">
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Right — timeline */}
        <div className="card-base p-5">
          <h3 className="font-mono text-xs uppercase text-text-muted mb-4">Timeline</h3>
          <div className="space-y-3 relative">
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
            {[...order.history].reverse().map((e, i) => (
              <div key={i} className="flex items-start gap-3 relative">
                <div className="w-4 h-4 rounded-full bg-bg-secondary border-2 border-accent-amber shrink-0 mt-0.5 z-10 flex items-center justify-center">
                  {e.type === 'quotation_accepted' || e.type === 'invoice_generated' ? (
                    <CheckCircle2 size={10} className="text-accent-amber" />
                  ) : e.type === 'note_added' ? (
                    <MessageSquare size={9} className="text-text-muted" />
                  ) : (
                    <Circle size={6} className="text-accent-amber fill-accent-amber" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-primary font-mono">{EVENT_LABEL[e.type] || e.type}</p>
                  <p className="text-[11px] text-text-muted truncate">{describeEvent(e)}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{formatDateTime(e.date)}{e.by ? ` · ${e.by}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {previewDoc && (
        <DocumentPreview doc={previewDoc} onClose={() => setPreviewDocId(null)} />
      )}

      {showSendModal && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-border rounded-lg max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="font-mono text-base font-bold text-text-primary flex items-center gap-2">
                <Mail size={16} className="text-accent-amber" /> Send tracking link
              </h3>
              <p className="text-text-secondary text-xs mt-1.5">
                Will be emailed to <span className="text-accent-amber font-mono">{resolvedEmail}</span> with the current status and a link to <code className="text-text-muted">/track/{order.id.slice(0, 14)}…</code>
              </p>
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Optional note to include</label>
              <textarea
                value={emailNote}
                onChange={(e) => setEmailNote(e.target.value)}
                placeholder="e.g. 'Production starts tomorrow morning' or 'Picked up by courier — should arrive by Wed'"
                rows={3}
                className="input-field text-sm w-full"
              />
            </div>
            {sendResult && (
              <div className={`text-xs font-mono p-2 rounded ${sendResult.ok ? 'bg-accent-green/10 text-accent-green border border-accent-green/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                {sendResult.ok ? '✓ ' : '✗ '}{sendResult.msg}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowSendModal(false); setSendResult(null); setEmailNote('') }}
                disabled={sending}
                className="btn-outline text-sm py-2 px-4 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendTracking}
                disabled={sending || !resolvedEmail}
                className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5 disabled:opacity-50"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
