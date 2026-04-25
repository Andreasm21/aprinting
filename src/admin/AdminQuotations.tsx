import { useState, useMemo, useRef, useEffect } from 'react'
import { FileText, Plus, Eye, Trash2, Search, Check, X, Edit3, ChevronDown, ArrowRight, Receipt, Lock } from 'lucide-react'
import { useInvoicesStore, CYPRUS_VAT_RATE, type Invoice, type InvoiceLineItem, type DocumentStatus } from '@/stores/invoicesStore'
import { DISCOUNT_RATES, type Customer } from '@/stores/customersStore'
import CustomerSelector from './components/CustomerSelector'
import LineItemsEditor from './components/LineItemsEditor'
import DocumentPreview from './components/DocumentPreview'
import DeleteConfirmModal from './components/DeleteConfirmModal'

const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: 'text-text-muted border-border',
  sent: 'text-accent-blue border-accent-blue/30 bg-accent-blue/5',
  paid: 'text-accent-green border-accent-green/30 bg-accent-green/5',
  cancelled: 'text-red-400 border-red-400/30 bg-red-400/5',
}

// VAT inclusion status is shown in the totals area now, so the terms text
// just states the currency. This avoids contradicting the totals when an
// admin disables VAT for a specific customer.
const DEFAULT_TERMS = `• This quotation is valid for 30 days from the date of issue.
• Prices are in EUR.
• Estimated weight is approximate; final pricing may vary ±15% based on actual print weight.
• Payment is due upon completion unless otherwise agreed.
• Standard delivery within Cyprus is included for orders over €50.
• Revisions to the 3D model are limited to 2 rounds; additional revisions at €15/hr.
• All intellectual property remains with the client.`

function calcTotals(lineItems: InvoiceLineItem[], deliveryFee: number, vatRate: number, discountPercent: number, extraCharge = 0) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
  const discountAmount = subtotal * (discountPercent / 100)
  const afterDiscount = subtotal - discountAmount
  const vatAmount = afterDiscount * vatRate
  const total = afterDiscount + vatAmount + deliveryFee + extraCharge
  return { subtotal, discountAmount, vatAmount, total }
}

export default function AdminQuotations() {
  const { invoices, addInvoice, updateInvoice, deleteInvoice, getNextNumber, convertToInvoice } = useInvoicesStore()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DocumentStatus>('all')
  const [editing, setEditing] = useState<Invoice | null>(null)
  const [creating, setCreating] = useState(false)
  const [previewing, setPreviewing] = useState<Invoice | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; label: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const quotesList = useMemo(() => {
    return invoices
      .filter((inv) => inv.type === 'quotation')
      .filter((inv) => statusFilter === 'all' || inv.status === statusFilter)
      .filter((inv) => {
        if (!search) return true
        const q = search.toLowerCase()
        return inv.customerName.toLowerCase().includes(q) || inv.documentNumber.toLowerCase().includes(q) || (inv.customerCompany || '').toLowerCase().includes(q)
      })
  }, [invoices, search, statusFilter])

  const requestDelete = (id: string) => {
    const q = quotesList.find((x) => x.id === id)
    if (!q) return
    setDeleteTarget({ ids: [id], label: `${q.documentNumber} — ${q.customerName}` })
  }

  const requestBulkDelete = () => {
    if (selectedIds.size === 0) return
    setDeleteTarget({ ids: Array.from(selectedIds), label: `${selectedIds.size} selected quotation${selectedIds.size > 1 ? 's' : ''}` })
  }

  const confirmDeletion = () => {
    if (!deleteTarget) return
    for (const id of deleteTarget.ids) deleteInvoice(id)
    setDeleteTarget(null)
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === quotesList.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(quotesList.map((q) => q.id)))
  }

  const stats = useMemo(() => {
    const all = invoices.filter((i) => i.type === 'quotation')
    return {
      total: all.length,
      draft: all.filter((i) => i.status === 'draft').length,
      sent: all.filter((i) => i.status === 'sent').length,
      accepted: all.filter((i) => i.status === 'paid').length,
      value: all.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.total, 0),
    }
  }, [invoices])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-2xl font-bold text-text-primary flex items-center gap-2">
            <FileText size={24} className="text-accent-blue" /> Quotations
          </h1>
          <p className="text-text-secondary text-sm mt-1">Create and manage quotations for custom jobs.</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={requestBulkDelete}
              className="text-xs font-mono py-2 px-4 rounded-lg border border-red-400 text-red-400 hover:bg-red-400/10 flex items-center gap-1.5"
            >
              <Trash2 size={13} /> Delete {selectedIds.size}
            </button>
          )}
          <button onClick={() => setCreating(true)} className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5">
            <Plus size={14} /> New Quotation
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-text-primary' },
          { label: 'Draft', value: stats.draft, color: 'text-text-muted' },
          { label: 'Sent', value: stats.sent, color: 'text-accent-blue' },
          { label: 'Accepted', value: stats.accepted, color: 'text-accent-green' },
          { label: 'Value', value: `€${stats.value.toFixed(2)}`, color: 'text-accent-amber' },
        ].map((s) => (
          <div key={s.label} className="card-base p-3 text-center">
            <div className={`font-mono text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-text-muted uppercase font-mono">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quotations..." className="input-field pl-9 text-sm py-2" />
        </div>
        <div className="flex gap-1">
          {(['all', 'draft', 'sent', 'paid', 'cancelled'] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`text-xs font-mono px-3 py-2 rounded-lg border transition-all ${statusFilter === s ? 'border-accent-blue text-accent-blue bg-accent-blue/5' : 'border-border text-text-muted hover:text-text-secondary'}`}>
              {s === 'paid' ? 'Accepted' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {quotesList.length === 0 ? (
        <div className="card-base p-10 text-center">
          <FileText size={32} className="mx-auto text-text-muted mb-3 opacity-50" />
          <p className="text-text-muted text-sm font-mono">No quotations found</p>
        </div>
      ) : (
        <div className="card-base overflow-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={quotesList.length > 0 && selectedIds.size === quotesList.length}
                    onChange={toggleSelectAll}
                    className="accent-accent-amber"
                  />
                </th>
                <th className="text-left p-3 font-mono text-xs text-text-muted uppercase">Number</th>
                <th className="text-left p-3 font-mono text-xs text-text-muted uppercase">Customer</th>
                <th className="text-left p-3 font-mono text-xs text-text-muted uppercase hidden sm:table-cell">Date</th>
                <th className="text-left p-3 font-mono text-xs text-text-muted uppercase hidden md:table-cell">Valid Until</th>
                <th className="text-right p-3 font-mono text-xs text-text-muted uppercase">Total</th>
                <th className="text-center p-3 font-mono text-xs text-text-muted uppercase">Status</th>
                <th className="text-right p-3 font-mono text-xs text-text-muted uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotesList.map((inv) => (
                <tr key={inv.id} className={`border-b border-border last:border-0 hover:bg-bg-tertiary/50 transition-colors ${selectedIds.has(inv.id) ? 'bg-accent-amber/5' : ''}`}>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(inv.id)}
                      onChange={() => toggleSelect(inv.id)}
                      className="accent-accent-amber"
                    />
                  </td>
                  <td className="p-3 font-mono text-xs text-accent-blue">{inv.documentNumber}</td>
                  <td className="p-3">
                    <div className="text-text-primary text-sm">{inv.customerName}</div>
                    {inv.customerCompany && <div className="text-[11px] text-text-muted">{inv.customerCompany}</div>}
                  </td>
                  <td className="p-3 text-text-secondary text-xs hidden sm:table-cell">{new Date(inv.date).toLocaleDateString('en-GB')}</td>
                  <td className="p-3 text-text-secondary text-xs hidden md:table-cell">
                    {inv.validUntil ? (
                      <span className={new Date(inv.validUntil) < new Date() ? 'text-red-400' : ''}>
                        {new Date(inv.validUntil).toLocaleDateString('en-GB')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="p-3 text-right font-mono text-sm text-text-primary">€{inv.total.toFixed(2)}</td>
                  <td className="p-3 text-center">
                    {inv.status === 'paid' ? (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-1 rounded-full border ${STATUS_COLORS['paid']}`}>
                        <Lock size={9} /> Accepted
                      </span>
                    ) : (
                      <StatusDropdown
                        status={inv.status}
                        onChange={(newStatus) => {
                          if (newStatus === 'paid' && inv.status !== 'paid') {
                            convertToInvoice(inv.id)
                          } else {
                            updateInvoice(inv.id, { status: newStatus })
                          }
                        }}
                      />
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setPreviewing(inv)} className="p-1.5 hover:bg-bg-tertiary rounded text-text-muted hover:text-accent-blue" title="Preview">
                        <Eye size={14} />
                      </button>
                      {inv.status !== 'paid' && (
                        <>
                          <button onClick={() => setEditing(inv)} className="p-1.5 hover:bg-bg-tertiary rounded text-text-muted hover:text-accent-blue" title="Edit">
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => convertToInvoice(inv.id)}
                            className="p-1.5 hover:bg-bg-tertiary rounded text-text-muted hover:text-accent-green"
                            title="Convert to Invoice"
                          >
                            <Receipt size={14} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => requestDelete(inv.id)}
                        className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor Modal */}
      {(creating || editing) && (
        <QuotationEditor
          initial={editing || undefined}
          onSave={(data) => {
            if (editing) {
              updateInvoice(editing.id, data)
            } else {
              addInvoice(data)
            }
            setEditing(null)
            setCreating(false)
          }}
          onClose={() => { setEditing(null); setCreating(false) }}
          getNextNumber={getNextNumber}
        />
      )}

      {/* Preview */}
      {previewing && <DocumentPreview doc={previewing} onClose={() => setPreviewing(null)} />}

      {deleteTarget && (
        <DeleteConfirmModal
          label={deleteTarget.label}
          count={deleteTarget.ids.length}
          onConfirm={confirmDeletion}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

/* ── Quotation Editor Modal ─────────────────────────────── */

function QuotationEditor({
  initial,
  onSave,
  onClose,
  getNextNumber,
}: {
  initial?: Invoice
  onSave: (data: Omit<Invoice, 'id' | 'createdAt'>) => void
  onClose: () => void
  getNextNumber: (type: 'quotation') => string
}) {
  const defaultValidUntil = new Date()
  defaultValidUntil.setDate(defaultValidUntil.getDate() + 30)

  const [form, setForm] = useState({
    documentNumber: initial?.documentNumber || getNextNumber('quotation'),
    date: initial?.date || new Date().toISOString(),
    validUntil: initial?.validUntil || defaultValidUntil.toISOString(),
    customerId: initial?.customerId || '',
    customerName: initial?.customerName || '',
    customerEmail: initial?.customerEmail || '',
    customerCompany: initial?.customerCompany || '',
    customerVatNumber: initial?.customerVatNumber || '',
    billingAddress: initial?.billingAddress || '',
    billingCity: initial?.billingCity || '',
    billingPostalCode: initial?.billingPostalCode || '',
    lineItems: initial?.lineItems || [{ description: '', unitPrice: 0, quantity: 1, total: 0 }] as InvoiceLineItem[],
    deliveryFee: initial?.deliveryFee ?? 0,
    discountPercent: initial?.discountPercent ?? 0,
    extraCharge: initial?.extraCharge ?? 0,
    extraChargeNote: initial?.extraChargeNote || '',
    notes: initial?.notes || '',
    termsAndConditions: initial?.termsAndConditions || DEFAULT_TERMS,
    status: initial?.status || 'draft' as DocumentStatus,
    // VAT toggle — defaults to ON. If the existing document has vatRate=0 we treat it as OFF.
    vatEnabled: initial ? (initial.vatRate ?? CYPRUS_VAT_RATE) > 0 : true,
    // Optional final-price override. When set, the customer-facing render shows
    // just this value as the total (no breakdown). Use to negotiate up from the
    // formula-calculated price.
    overrideEnabled: initial?.totalOverride != null,
    totalOverride: initial?.totalOverride ?? 0,
  })

  const effectiveVatRate = form.vatEnabled ? CYPRUS_VAT_RATE : 0
  const calculatedTotals = calcTotals(form.lineItems, form.deliveryFee, effectiveVatRate, form.discountPercent, form.extraCharge)
  // Final total: the override wins if enabled, otherwise the calculated total.
  const finalTotal = form.overrideEnabled ? form.totalOverride : calculatedTotals.total
  const totals = { ...calculatedTotals, total: finalTotal }

  const handleCustomerSelect = (customer: Customer | null) => {
    if (!customer) {
      setForm((f) => ({ ...f, customerId: '', customerName: '', customerEmail: '', customerCompany: '', customerVatNumber: '', billingAddress: '', billingCity: '', billingPostalCode: '', discountPercent: 0 }))
      return
    }
    const discountPercent = DISCOUNT_RATES[customer.discountTier || 'none'] ?? 0
    setForm((f) => ({
      ...f,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerCompany: customer.company || '',
      customerVatNumber: customer.vatNumber || '',
      billingAddress: customer.billingAddress || customer.address || '',
      billingCity: customer.billingCity || customer.city || '',
      billingPostalCode: customer.billingPostalCode || customer.postalCode || '',
      discountPercent,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      type: 'quotation',
      documentNumber: form.documentNumber,
      date: form.date,
      validUntil: form.validUntil,
      customerId: form.customerId || undefined,
      customerName: form.customerName,
      customerEmail: form.customerEmail,
      customerCompany: form.customerCompany || undefined,
      customerVatNumber: form.customerVatNumber || undefined,
      billingAddress: form.billingAddress,
      billingCity: form.billingCity || undefined,
      billingPostalCode: form.billingPostalCode || undefined,
      lineItems: form.lineItems,
      subtotal: totals.subtotal,
      vatRate: effectiveVatRate,
      vatAmount: totals.vatAmount,
      totalOverride: form.overrideEnabled ? Number(form.totalOverride) : undefined,
      deliveryFee: form.deliveryFee,
      discountPercent: form.discountPercent,
      discountAmount: totals.discountAmount,
      extraCharge: form.extraCharge > 0 ? form.extraCharge : undefined,
      extraChargeNote: form.extraCharge > 0 && form.extraChargeNote.trim() ? form.extraChargeNote.trim() : undefined,
      total: totals.total,
      notes: form.notes || undefined,
      termsAndConditions: form.termsAndConditions || undefined,
      status: form.status,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bg-secondary border border-border rounded-lg max-w-2xl w-full max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-bg-secondary z-10">
          <h2 className="font-mono text-lg font-bold text-text-primary">{initial ? 'Edit Quotation' : 'New Quotation'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded"><X size={20} className="text-text-muted" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Doc number, date, valid until */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Quote Number</label>
              <input value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} className="input-field text-sm" />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Date</label>
              <input type="date" value={form.date.split('T')[0]} onChange={(e) => setForm({ ...form, date: new Date(e.target.value).toISOString() })} className="input-field text-sm" />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Valid Until</label>
              <input type="date" value={form.validUntil.split('T')[0]} onChange={(e) => setForm({ ...form, validUntil: new Date(e.target.value).toISOString() })} className="input-field text-sm" />
            </div>
          </div>

          {/* Customer */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Customer</label>
            <CustomerSelector selectedId={form.customerId || undefined} onSelect={handleCustomerSelect} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Name *</label>
              <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="input-field text-sm" required />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Email *</label>
              <input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} className="input-field text-sm" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Company</label>
              <input value={form.customerCompany} onChange={(e) => setForm({ ...form, customerCompany: e.target.value })} className="input-field text-sm" />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">VAT Number</label>
              <input value={form.customerVatNumber} onChange={(e) => setForm({ ...form, customerVatNumber: e.target.value })} className="input-field text-sm" />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Billing Address</label>
            <input value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} className="input-field text-sm" />
          </div>

          {/* Line Items */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-2">Line Items</label>
            <LineItemsEditor items={form.lineItems} onChange={(items) => setForm({ ...form, lineItems: items })} showMaterialFields />
          </div>

          {/* Fees & Discount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Delivery Fee</label>
              <input type="number" step="0.01" min={0} value={form.deliveryFee} onChange={(e) => setForm({ ...form, deliveryFee: parseFloat(e.target.value) || 0 })} className="input-field text-sm" />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Discount %</label>
              <input type="number" step="0.5" min={0} max={100} value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: parseFloat(e.target.value) || 0 })} className="input-field text-sm" />
            </div>
          </div>

          {/* Extra Charge */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Extra Charge (€)</label>
              <input type="number" step="0.01" min={0} value={form.extraCharge} onChange={(e) => setForm({ ...form, extraCharge: parseFloat(e.target.value) || 0 })} className="input-field text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Extra Charge Note</label>
              <input type="text" value={form.extraChargeNote} onChange={(e) => setForm({ ...form, extraChargeNote: e.target.value })} placeholder="e.g. rush fee, handling, custom service" className="input-field text-sm" />
            </div>
          </div>

          {/* Totals Summary */}
          <div className="bg-bg-tertiary rounded-lg p-4 space-y-1.5 text-sm font-mono">
            <div className="flex justify-between text-text-secondary">
              <span>Subtotal <span className="text-[10px] text-accent-amber">(incl. markup)</span></span>
              <span>€{totals.subtotal.toFixed(2)}</span>
            </div>
            {form.discountPercent > 0 && (
              <div className="flex justify-between text-accent-green">
                <span>Discount ({form.discountPercent}%)</span>
                <span>-€{totals.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-text-secondary">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.vatEnabled}
                  onChange={(e) => setForm({ ...form, vatEnabled: e.target.checked })}
                  className="accent-accent-amber"
                />
                <span>VAT (19%) {!form.vatEnabled && <span className="text-[10px] text-text-muted">— disabled</span>}</span>
              </label>
              <span>€{totals.vatAmount.toFixed(2)}</span>
            </div>
            {form.deliveryFee > 0 && (
              <div className="flex justify-between text-text-secondary">
                <span>Delivery</span>
                <span>€{form.deliveryFee.toFixed(2)}</span>
              </div>
            )}
            {form.extraCharge > 0 && (
              <div className="flex justify-between text-text-secondary">
                <span>Extra{form.extraChargeNote ? ` (${form.extraChargeNote})` : ''}</span>
                <span>€{form.extraCharge.toFixed(2)}</span>
              </div>
            )}

            {/* Final price override — admin-only. Customer-facing render hides this mechanism. */}
            <div className="pt-2 border-t border-border space-y-2">
              <label className="flex items-center justify-between gap-2 cursor-pointer select-none text-text-secondary">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.overrideEnabled}
                    onChange={(e) => setForm({ ...form, overrideEnabled: e.target.checked, totalOverride: e.target.checked && !form.totalOverride ? calculatedTotals.total : form.totalOverride })}
                    className="accent-accent-amber"
                  />
                  <span>Override final price</span>
                </span>
                {form.overrideEnabled && (
                  <span className="text-[10px] text-text-muted line-through">€{calculatedTotals.total.toFixed(2)} calc.</span>
                )}
              </label>
              {form.overrideEnabled && (
                <div className="flex items-center gap-2">
                  <span className="text-text-muted text-xs">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.totalOverride}
                    onChange={(e) => setForm({ ...form, totalOverride: parseFloat(e.target.value) || 0 })}
                    className="input-field text-sm font-mono flex-1"
                    placeholder="Negotiated final price"
                  />
                </div>
              )}
              <p className="text-[10px] text-text-muted leading-snug">
                Only the final TOTAL is shown on the customer-facing quotation. The override mechanism is hidden from the rendered PDF.
              </p>
            </div>

            <div className="flex justify-between pt-2 border-t border-border text-text-primary font-bold text-base">
              <span>Total {form.overrideEnabled && <span className="text-[10px] text-accent-amber font-normal">(overridden)</span>}</span>
              <span className="text-accent-blue">€{totals.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field text-sm resize-none" rows={2} placeholder="Project description, special requirements..." />
          </div>

          {/* Terms & Conditions */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Terms & Conditions</label>
            <textarea value={form.termsAndConditions} onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })} className="input-field text-sm resize-none" rows={5} />
          </div>

          {/* Status */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as DocumentStatus })} className="input-field text-sm">
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Accepted</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-outline text-sm py-2 px-4">Cancel</button>
            <button type="submit" className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5">
              <Check size={14} /> Save Quotation
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Status Dropdown ─────────────────────────────── */

const QUOTE_STATUSES: { value: DocumentStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { value: 'draft', label: 'Draft', color: 'text-text-muted', icon: <FileText size={12} /> },
  { value: 'sent', label: 'Sent', color: 'text-accent-blue', icon: <ArrowRight size={12} /> },
  { value: 'paid', label: 'Accepted', color: 'text-accent-green', icon: <Check size={12} /> },
  { value: 'cancelled', label: 'Cancelled', color: 'text-red-400', icon: <X size={12} /> },
]

function StatusDropdown({ status, onChange }: { status: DocumentStatus; onChange: (s: DocumentStatus) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    // Use setTimeout to avoid catching the same click that opened the dropdown
    const id = setTimeout(() => document.addEventListener('click', handleClick), 0)
    return () => { clearTimeout(id); document.removeEventListener('click', handleClick) }
  }, [open])

  const current = QUOTE_STATUSES.find((s) => s.value === status) || QUOTE_STATUSES[0]

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className={`flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-1 rounded-full border transition-all hover:brightness-125 cursor-pointer ${STATUS_COLORS[status]}`}
      >
        {current.label}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-bg-secondary border border-border rounded-lg shadow-xl z-50 min-w-[140px] py-1">
          {QUOTE_STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={(e) => { e.stopPropagation(); onChange(s.value); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-mono transition-colors hover:bg-bg-tertiary ${
                s.value === status ? 'bg-bg-tertiary font-bold' : ''
              } ${s.color}`}
            >
              {s.icon}
              {s.label}
              {s.value === 'paid' && status !== 'paid' && (
                <span className="ml-auto text-[9px] text-accent-green opacity-70">+ invoice</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
