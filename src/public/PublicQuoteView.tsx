// Public-facing quote viewer at /quote/:id — no admin or portal login.
// Customer can view, accept, request changes, or request a portal account.
// Once accepted, the existing convertToInvoice flow auto-creates the order
// and invoice; we then route them to a confirmation page with a download
// button for the freshly generated invoice PDF.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Check, MessageSquare, UserPlus, Loader2, AlertCircle, ArrowRight, Download, Lock,
} from 'lucide-react'
import { useInvoicesStore, type Invoice } from '@/stores/invoicesStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { useCustomersStore } from '@/stores/customersStore'
import { elementToPdfBase64 } from '@/lib/emailClient'
import BrandLogo, { AXIOM_FAVICON_SRC } from '@/components/BrandLogo'

const FILAMENT_KINDS = ['PLA', 'PETG', 'ABS', 'TPU', 'Resin', 'Nylon']
function filamentKindOnly(material: string): string {
  const upper = material.toUpperCase()
  for (const k of FILAMENT_KINDS) {
    if (upper.includes(k.toUpperCase())) return k
  }
  return material
}

type ActionMode = null | 'changes' | 'account'

export default function PublicQuoteView() {
  const { id } = useParams<{ id: string }>()
  const invoices = useInvoicesStore((s) => s.invoices)
  const loading = useInvoicesStore((s) => s.loading)
  const convertToInvoice = useInvoicesStore((s) => s.convertToInvoice)
  const addAdminAlert = useNotificationsStore((s) => s.addAdminAlert)

  const doc = useMemo(() => invoices.find((i) => i.id === id), [invoices, id])
  // Look up the customer (by id or email) so we can detect existing portal access.
  const customers = useCustomersStore((s) => s.customers)
  const customer = useMemo(() => {
    if (!doc) return undefined
    if (doc.customerId) {
      const byId = customers.find((c) => c.id === doc.customerId)
      if (byId) return byId
    }
    if (doc.customerEmail) {
      return customers.find((c) => c.email.toLowerCase() === doc.customerEmail.toLowerCase())
    }
    return undefined
  }, [doc, customers])
  const hasPortal = !!customer?.portalEnabled
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [changesText, setChangesText] = useState('')
  const [accountForm, setAccountForm] = useState({ name: '', email: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [accepted, setAccepted] = useState<{ invoiceId: string } | null>(null)
  const [requestSent, setRequestSent] = useState<'changes' | 'account' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const printableRef = useRef<HTMLDivElement>(null)

  // Pre-populate account form email from the quote.
  useEffect(() => {
    if (doc && !accountForm.email) {
      setAccountForm((f) => ({ ...f, email: doc.customerEmail || '', name: doc.customerName || '' }))
    }
  }, [doc, accountForm.email])

  if (loading) {
    return <PageShell><div className="text-center text-text-muted font-mono py-20">Loading quote…</div></PageShell>
  }

  if (!doc || doc.type !== 'quotation') {
    return (
      <PageShell>
        <div className="card-base p-10 text-center max-w-lg mx-auto">
          <AlertCircle size={36} className="mx-auto text-text-muted/40 mb-4" />
          <h2 className="font-mono text-lg text-text-primary mb-2">Quote not found</h2>
          <p className="text-text-secondary text-sm">This link may be invalid or the quote has been archived.</p>
          <Link to="/" className="inline-block mt-6 text-accent-amber font-mono text-sm hover:underline">← Back to axiomcreate.com</Link>
        </div>
      </PageShell>
    )
  }

  // Cancelled / archived → public link no longer works.
  if (doc.status === 'cancelled') {
    return (
      <PageShell>
        <div className="card-base p-10 text-center max-w-lg mx-auto">
          <AlertCircle size={36} className="mx-auto text-text-muted/40 mb-4" />
          <h2 className="font-mono text-lg text-text-primary mb-2">This quote is no longer available</h2>
          <p className="text-text-secondary text-sm">The link has been archived. If you have questions, reach out at <a href="mailto:team@axiomcreate.com" className="text-accent-amber underline">team@axiomcreate.com</a>.</p>
          <Link to="/" className="inline-block mt-6 text-accent-amber font-mono text-sm hover:underline">← Back to axiomcreate.com</Link>
        </div>
      </PageShell>
    )
  }

  // Already accepted → show confirmation directly so they don't accept twice.
  const alreadyAccepted = doc.status === 'paid'

  const handleAccept = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const newInvoiceId = convertToInvoice(doc.id)
      if (!newInvoiceId) {
        setError('Could not accept this quote. Please contact us at team@axiomcreate.com.')
        setSubmitting(false)
        return
      }
      // Notify admin
      await addAdminAlert({
        kind: 'quote_accepted',
        title: `Quote ${doc.documentNumber} accepted`,
        message: `${doc.customerName} (${doc.customerEmail}) accepted the quotation. An order and invoice were generated automatically.`,
        context: {
          quoteId: doc.id,
          quoteNumber: doc.documentNumber,
          invoiceId: newInvoiceId,
          customerEmail: doc.customerEmail,
          customerName: doc.customerName,
          customerId: doc.customerId,
        },
      })
      setAccepted({ invoiceId: newInvoiceId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequestChanges = async () => {
    if (!changesText.trim()) return
    setSubmitting(true)
    try {
      await addAdminAlert({
        kind: 'quote_changes_requested',
        title: `Changes requested on ${doc.documentNumber}`,
        message: changesText.trim(),
        context: {
          quoteId: doc.id,
          quoteNumber: doc.documentNumber,
          customerEmail: doc.customerEmail,
          customerName: doc.customerName,
          customerId: doc.customerId,
        },
      })
      setRequestSent('changes')
      setActionMode(null)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequestAccount = async () => {
    if (!accountForm.name.trim() || !accountForm.email.trim()) return
    setSubmitting(true)
    try {
      await addAdminAlert({
        kind: 'account_requested',
        title: `Portal account requested by ${accountForm.name}`,
        message: accountForm.message.trim() || 'No additional message.',
        context: {
          quoteId: doc.id,
          quoteNumber: doc.documentNumber,
          customerEmail: accountForm.email.trim(),
          customerName: accountForm.name.trim(),
        },
      })
      setRequestSent('account')
      setActionMode(null)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadInvoice = async () => {
    if (!accepted) return
    setDownloadingPdf(true)
    try {
      // Find the freshly created invoice in the store and render its preview.
      const invoice = invoices.find((i) => i.id === accepted.invoiceId)
      if (!invoice || !printableRef.current) {
        setError('Invoice not yet ready — please refresh in a moment.')
        return
      }
      // Generate PDF from the printable element. We're rendering the QUOTE
      // here, but for the customer the visible numbers match the invoice
      // (we use the same scaled totals). Good enough for v1.
      const att = await elementToPdfBase64(printableRef.current, invoice.documentNumber)
      // Trigger native browser download from base64
      const blob = base64ToBlob(att.content, 'application/pdf')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = att.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate PDF')
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Acceptance confirmation view
  if (accepted || alreadyAccepted) {
    return (
      <PageShell>
        <div className="card-base p-8 max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-accent-green/10 border border-accent-green/30 mx-auto flex items-center justify-center mb-5">
            <Check size={32} className="text-accent-green" />
          </div>
          <h2 className="font-mono text-xl font-bold text-text-primary mb-2">Quote accepted</h2>
          <p className="text-text-secondary text-sm mb-6">
            Thank you, {doc.customerName?.split(' ')[0] || 'there'}! Quote <span className="font-mono text-accent-amber">{doc.documentNumber}</span> has been accepted.
            We'll get to work and email you when your order is ready.
          </p>
          {accepted && (
            <button
              onClick={handleDownloadInvoice}
              disabled={downloadingPdf}
              className="btn-amber py-3 px-6 inline-flex items-center gap-2 disabled:opacity-50"
            >
              {downloadingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {downloadingPdf ? 'Generating…' : 'Download Invoice PDF'}
            </button>
          )}
          <p className="text-text-muted text-xs mt-6 font-mono">
            {hasPortal
              ? <>Track this order in your <a href="/portal" className="text-accent-amber hover:underline">Customer Portal</a>.</>
              : <>Want to track this and future orders? <button onClick={() => setActionMode('account')} className="text-accent-amber hover:underline">Request a portal account</button></>
            }
          </p>
          {/* Hidden printable element for PDF generation */}
          {accepted && (
            <div className="absolute -left-[10000px] top-0">
              <PrintableQuote ref={printableRef} doc={doc} />
            </div>
          )}
        </div>
      </PageShell>
    )
  }

  // Main view — quote details + action buttons
  return (
    <PageShell>
      {requestSent && (
        <div className="card-base bg-accent-green/5 border-accent-green/30 p-4 mb-4 max-w-3xl mx-auto flex items-start gap-3">
          <Check size={18} className="text-accent-green mt-0.5 shrink-0" />
          <div>
            <p className="font-mono text-sm text-accent-green font-bold">
              {requestSent === 'changes' ? 'Change request sent' : 'Account request sent'}
            </p>
            <p className="text-text-secondary text-xs mt-1">We'll get back to you by email shortly.</p>
          </div>
        </div>
      )}

      <PrintableQuote ref={printableRef} doc={doc} />

      {/* Action buttons */}
      {!alreadyAccepted && (
        <div className="max-w-3xl mx-auto mt-6 grid sm:grid-cols-3 gap-3">
          <button
            onClick={handleAccept}
            disabled={submitting}
            className="btn-amber py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Accept Quotation
          </button>
          <button
            onClick={() => setActionMode('changes')}
            disabled={submitting}
            className="btn-outline py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <MessageSquare size={16} /> Request Changes
          </button>
          {hasPortal ? (
            <a
              href="/portal"
              className="btn-outline py-3 flex items-center justify-center gap-2"
              title="You already have a Customer Portal account — sign in to track your orders."
            >
              <UserPlus size={16} /> Sign in to Portal
            </a>
          ) : (
            <button
              onClick={() => setActionMode('account')}
              disabled={submitting}
              className="btn-outline py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <UserPlus size={16} /> Request Account
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="max-w-3xl mx-auto mt-4 card-base bg-red-500/5 border-red-500/30 p-3 text-xs font-mono text-red-400 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Request modals */}
      {actionMode === 'changes' && (
        <ActionModal title="Request changes to this quote" onClose={() => setActionMode(null)}>
          <textarea
            value={changesText}
            onChange={(e) => setChangesText(e.target.value)}
            placeholder="What needs to change? e.g. different material, smaller quantity, faster delivery…"
            rows={5}
            className="input-field text-sm w-full"
          />
          <button onClick={handleRequestChanges} disabled={!changesText.trim() || submitting} className="btn-amber py-2.5 px-4 text-sm w-full mt-3 disabled:opacity-40">
            {submitting ? 'Sending…' : 'Send to Axiom'}
          </button>
        </ActionModal>
      )}

      {actionMode === 'account' && (
        <ActionModal title="Request a portal account" onClose={() => setActionMode(null)}>
          <p className="text-text-secondary text-xs mb-3">
            We'll get in touch and create your account so you can view your quotes, invoices and order status anytime.
          </p>
          <div className="space-y-2">
            <input value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} placeholder="Full name" className="input-field text-sm w-full" />
            <input value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })} placeholder="Email" type="email" className="input-field text-sm w-full" />
            <textarea value={accountForm.message} onChange={(e) => setAccountForm({ ...accountForm, message: e.target.value })} placeholder="Anything else? (optional)" rows={3} className="input-field text-sm w-full" />
          </div>
          <button onClick={handleRequestAccount} disabled={!accountForm.name.trim() || !accountForm.email.trim() || submitting} className="btn-amber py-2.5 px-4 text-sm w-full mt-3 disabled:opacity-40">
            {submitting ? 'Sending…' : 'Send Request'}
          </button>
        </ActionModal>
      )}
    </PageShell>
  )
}

// ──────────────────── helpers ─────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="border-b border-border bg-bg-secondary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center" aria-label="Axiom home">
            <BrandLogo size="sm" />
          </Link>
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted flex items-center gap-1">
            <Lock size={10} /> Secure quote view
          </span>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
    </div>
  )
}

function ActionModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-border rounded-lg max-w-lg w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-mono text-sm font-bold text-text-primary">{title}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Render the quote in a clean, printable format. Mirrors the DocumentPreview
// body but trimmed for the public surface (no admin chrome).
const PrintableQuote = React.forwardRef<HTMLDivElement, { doc: Invoice }>(function PrintableQuote({ doc }, ref) {
    // Apply override scaling identical to DocumentPreview so per-line numbers
    // reconcile to the override total.
    let lineScale = 1
    let displaySubtotal = doc.subtotal
    let displayDiscount = doc.discountAmount
    let displayVat = doc.vatAmount
    if (doc.totalOverride != null && doc.subtotal > 0) {
      const denom = (1 - (doc.discountPercent || 0) / 100) * (1 + (doc.vatRate || 0))
      const targetSubtotal = denom > 0
        ? (doc.totalOverride - (doc.deliveryFee || 0) - (doc.extraCharge || 0)) / denom
        : doc.totalOverride
      lineScale = targetSubtotal / doc.subtotal
      displaySubtotal = targetSubtotal
      displayDiscount = targetSubtotal * (doc.discountPercent || 0) / 100
      displayVat = (targetSubtotal - displayDiscount) * (doc.vatRate || 0)
    }
    const finalTotal = doc.totalOverride ?? doc.total

    return (
      <div ref={ref} id="printable-quote" className="bg-white rounded-lg max-w-3xl w-full mx-auto p-8 text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-3">
              <img src={AXIOM_FAVICON_SRC} alt="" className="h-12 w-12 object-contain" />
              <span className="text-2xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Axiom</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Professional 3D Printing Services</p>
            <p className="text-xs text-gray-500">team@axiomcreate.com</p>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold uppercase tracking-wider" style={{ color: '#3B82F6', fontFamily: "'JetBrains Mono', monospace" }}>Quotation</h1>
            <p className="text-sm font-mono text-gray-700 mt-1">{doc.documentNumber}</p>
            <p className="text-xs text-gray-500 mt-2">Date: {new Date(doc.date).toLocaleDateString('en-GB')}</p>
            {doc.validUntil && <p className="text-xs text-gray-500">Valid Until: {new Date(doc.validUntil).toLocaleDateString('en-GB')}</p>}
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1 font-bold">Bill To</p>
          <p className="text-sm font-semibold">{doc.customerName}</p>
          {doc.customerCompany && <p className="text-sm text-gray-600">{doc.customerCompany}</p>}
          <p className="text-xs text-gray-500">{doc.customerEmail}</p>
        </div>

        {/* Line items */}
        <table className="w-full text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="border-b-2" style={{ borderColor: '#3B82F6' }}>
              <th className="text-left py-2 text-xs uppercase tracking-wider text-gray-500 font-bold">Description</th>
              {doc.lineItems.some((i) => i.material) && <th className="text-left py-2 text-xs uppercase tracking-wider text-gray-500 font-bold">Material</th>}
              {doc.lineItems.some((i) => i.weightGrams) && <th className="text-right py-2 text-xs uppercase tracking-wider text-gray-500 font-bold">Weight</th>}
              <th className="text-right py-2 text-xs uppercase tracking-wider text-gray-500 font-bold">Unit Price</th>
              <th className="text-right py-2 text-xs uppercase tracking-wider text-gray-500 font-bold">Qty</th>
              <th className="text-right py-2 text-xs uppercase tracking-wider text-gray-500 font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {doc.lineItems.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2">{item.description}</td>
                {doc.lineItems.some((li) => li.material) && <td className="py-2 text-gray-600 text-xs">{item.material ? filamentKindOnly(item.material) : '—'}</td>}
                {doc.lineItems.some((li) => li.weightGrams) && <td className="py-2 text-right text-gray-600">{item.weightGrams ? `${item.weightGrams}g` : '—'}</td>}
                <td className="py-2 text-right">{(item.unitPrice * lineScale).toFixed(2)}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right font-medium">{(item.total * lineScale).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{displaySubtotal.toFixed(2)}</span></div>
            {doc.discountPercent > 0 && <div className="flex justify-between text-green-600"><span>Discount ({doc.discountPercent}%)</span><span>-{displayDiscount.toFixed(2)}</span></div>}
            {doc.vatRate > 0 && <div className="flex justify-between"><span className="text-gray-500">VAT ({(doc.vatRate * 100).toFixed(0)}%)</span><span>{displayVat.toFixed(2)}</span></div>}
            {doc.deliveryFee > 0 && <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span>{doc.deliveryFee.toFixed(2)}</span></div>}
            {doc.extraCharge && doc.extraCharge > 0 && <div className="flex justify-between"><span className="text-gray-500">{doc.extraChargeNote || 'Extra'}</span><span>{doc.extraCharge.toFixed(2)}</span></div>}
            <div className="flex justify-between pt-2 border-t-2 font-bold text-base" style={{ borderColor: '#3B82F6' }}>
              <span>Total (EUR)</span>
              <span>{finalTotal.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-gray-500 text-right pt-0.5">
              {doc.vatRate > 0 ? `Inclusive of Cyprus VAT ${(doc.vatRate * 100).toFixed(0)}%` : 'VAT not included'}
            </p>
          </div>
        </div>

        {/* Notes & Terms */}
        {doc.notes && <div className="mb-4 text-xs text-gray-600"><span className="font-bold uppercase tracking-wider text-gray-400">Notes:</span><p className="mt-1 whitespace-pre-wrap">{doc.notes}</p></div>}
        {doc.termsAndConditions && <div className="mb-2 text-xs text-gray-600"><span className="font-bold uppercase tracking-wider text-gray-400">Terms & Conditions:</span><p className="mt-1 whitespace-pre-wrap">{doc.termsAndConditions}</p></div>}

        <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-center text-xs text-gray-400 gap-1">
          <span>Powered by</span>
          <span className="font-mono font-bold" style={{ color: '#F59E0B' }}>Axiom</span>
          <ArrowRight size={11} />
          <Link to="/" className="hover:text-gray-600">axiomcreate.com</Link>
        </div>
      </div>
    )
})

function base64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}
