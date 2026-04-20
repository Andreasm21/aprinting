import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, User, UserPlus, Check, Building2, Mail, FileText } from 'lucide-react'
import { useCustomersStore, DISCOUNT_RATES, type Customer } from '@/stores/customersStore'
import { useInvoicesStore, CYPRUS_VAT_RATE, type InvoiceLineItem } from '@/stores/invoicesStore'
import { useQuoteCartStore } from '@/stores/quoteCartStore'
import CustomerSelector from './CustomerSelector'

type Mode = 'existing' | 'new'

interface NewCustomerForm {
  name: string
  email: string
  phone: string
  company: string
  vatNumber: string
  address: string
  city: string
  postalCode: string
}

function calcTotals(lineItems: InvoiceLineItem[], deliveryFee: number, vatRate: number, discountPercent: number, extraCharge = 0) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
  const discountAmount = subtotal * (discountPercent / 100)
  const afterDiscount = subtotal - discountAmount
  const vatAmount = afterDiscount * vatRate
  const total = afterDiscount + vatAmount + deliveryFee + extraCharge
  return { subtotal, discountAmount, vatAmount, total }
}

export default function QuoteCustomerPickerModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const items = useQuoteCartStore((s) => s.items)
  const clearCart = useQuoteCartStore((s) => s.clearCart)
  const closeCart = useQuoteCartStore((s) => s.closeCart)
  const addCustomer = useCustomersStore((s) => s.addCustomer)
  const customers = useCustomersStore((s) => s.customers)
  const addInvoice = useInvoicesStore((s) => s.addInvoice)
  const getNextNumber = useInvoicesStore((s) => s.getNextNumber)

  const [mode, setMode] = useState<Mode>('existing')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [newForm, setNewForm] = useState<NewCustomerForm>({
    name: '', email: '', phone: '', company: '', vatNumber: '', address: '', city: '', postalCode: '',
  })
  const [extraCharge, setExtraCharge] = useState(0)
  const [extraChargeNote, setExtraChargeNote] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const handleSelect = (customer: Customer | null) => {
    setSelectedCustomer(customer)
    setSelectedCustomerId(customer?.id)
  }

  const buildLineItems = (): InvoiceLineItem[] => {
    return items.map((item) => ({
      description: item.description,
      material: item.material,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      total: item.unitPrice * item.quantity,
    }))
  }

  const createQuotation = (customer: Customer) => {
    const lineItems = buildLineItems()
    const discountPercent = customer.discountTier ? DISCOUNT_RATES[customer.discountTier] : 0
    const { subtotal, discountAmount, vatAmount, total } = calcTotals(lineItems, 0, CYPRUS_VAT_RATE, discountPercent, extraCharge)

    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 30)

    const id = addInvoice({
      type: 'quotation',
      documentNumber: getNextNumber('quotation'),
      date: new Date().toISOString(),
      validUntil: validUntil.toISOString(),
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerCompany: customer.company,
      customerVatNumber: customer.vatNumber,
      billingAddress: customer.billingAddress || customer.address || '',
      billingCity: customer.billingCity || customer.city,
      billingPostalCode: customer.billingPostalCode || customer.postalCode,
      lineItems,
      subtotal,
      vatRate: CYPRUS_VAT_RATE,
      vatAmount,
      deliveryFee: 0,
      discountPercent,
      discountAmount,
      extraCharge: extraCharge > 0 ? extraCharge : undefined,
      extraChargeNote: extraCharge > 0 && extraChargeNote.trim() ? extraChargeNote.trim() : undefined,
      total,
      paymentTerms: customer.paymentTerms || 'immediate',
      notes: 'Generated from Quote Cart',
      termsAndConditions: '• This quotation is valid for 30 days from the date of issue.\n• Prices are in EUR and include Cyprus VAT at 19%.\n• Payment is due upon completion unless otherwise agreed.\n• Standard delivery within Cyprus is included for orders over €50.',
      status: 'draft',
    })

    clearCart()
    closeCart()
    onClose()
    navigate('/admin/quotations')
    return id
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCreating(true)

    try {
      if (mode === 'existing') {
        if (!selectedCustomer) {
          setError('Please select a customer')
          setCreating(false)
          return
        }
        createQuotation(selectedCustomer)
      } else {
        // Validate
        if (!newForm.name.trim() || !newForm.email.trim()) {
          setError('Name and email are required')
          setCreating(false)
          return
        }
        // Check duplicate email
        const existing = customers.find((c) => c.email.toLowerCase() === newForm.email.toLowerCase())
        if (existing) {
          setError(`Email already exists: ${existing.name}. Use Existing tab.`)
          setCreating(false)
          return
        }

        // Create the customer first
        addCustomer({
          accountType: newForm.company ? 'business' : 'individual',
          name: newForm.name.trim(),
          email: newForm.email.trim(),
          phone: newForm.phone.trim(),
          company: newForm.company.trim() || undefined,
          vatNumber: newForm.vatNumber.trim() || undefined,
          address: newForm.address.trim() || undefined,
          city: newForm.city.trim() || undefined,
          postalCode: newForm.postalCode.trim() || undefined,
          tags: [],
        })

        // The new customer is added at the front of the list — find it
        const justAdded = useCustomersStore.getState().customers.find(
          (c) => c.email.toLowerCase() === newForm.email.toLowerCase()
        )
        if (!justAdded) {
          setError('Failed to create customer. Try again.')
          setCreating(false)
          return
        }
        createQuotation(justAdded)
      }
    } catch (err) {
      console.error('[quote] error:', err)
      setError('Failed to create quotation')
      setCreating(false)
    }
  }

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const discountPct = selectedCustomer?.discountTier ? DISCOUNT_RATES[selectedCustomer.discountTier] : 0
  const previewTotal = (() => {
    const afterDisc = subtotal * (1 - discountPct / 100)
    return afterDisc * (1 + CYPRUS_VAT_RATE) + extraCharge
  })()

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bg-secondary border border-border rounded-lg max-w-lg w-full max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-bg-secondary z-10">
          <div>
            <h2 className="font-mono text-base font-bold text-text-primary flex items-center gap-2">
              <FileText size={16} className="text-accent-amber" /> Create Quotation
            </h2>
            <p className="text-text-muted text-xs font-mono mt-0.5">
              {items.length} item{items.length !== 1 ? 's' : ''} · €{subtotal.toFixed(2)} subtotal
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Mode tabs */}
          <div className="flex gap-1 border-b border-border">
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono transition-all border-b-2 -mb-px ${
                mode === 'existing'
                  ? 'border-accent-amber text-accent-amber'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <User size={14} /> Existing Customer
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono transition-all border-b-2 -mb-px ${
                mode === 'new'
                  ? 'border-accent-amber text-accent-amber'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <UserPlus size={14} /> New Customer
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'existing' && (
              <div className="space-y-3">
                <CustomerSelector selectedId={selectedCustomerId} onSelect={handleSelect} />
                {selectedCustomer && (
                  <div className="bg-bg-tertiary rounded-lg p-3 border border-border space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-text-primary font-bold">{selectedCustomer.name}</span>
                      {selectedCustomer.accountType === 'business' && (
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20">B2B</span>
                      )}
                      {selectedCustomer.discountTier && selectedCustomer.discountTier !== 'none' && (
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
                          {selectedCustomer.discountTier} -{DISCOUNT_RATES[selectedCustomer.discountTier]}%
                        </span>
                      )}
                    </div>
                    {selectedCustomer.company && (
                      <p className="text-xs text-text-secondary flex items-center gap-1.5">
                        <Building2 size={10} /> {selectedCustomer.company}
                      </p>
                    )}
                    <p className="text-xs text-text-muted flex items-center gap-1.5">
                      <Mail size={10} /> {selectedCustomer.email}
                    </p>
                  </div>
                )}
              </div>
            )}

            {mode === 'new' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] text-text-muted uppercase mb-1">Name *</label>
                    <input
                      value={newForm.name}
                      onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                      className="input-field text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] text-text-muted uppercase mb-1">Email *</label>
                    <input
                      type="email"
                      value={newForm.email}
                      onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                      className="input-field text-sm"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] text-text-muted uppercase mb-1">Phone</label>
                    <input
                      value={newForm.phone}
                      onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] text-text-muted uppercase mb-1">Company</label>
                    <input
                      value={newForm.company}
                      onChange={(e) => setNewForm({ ...newForm, company: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                </div>
                {newForm.company && (
                  <div>
                    <label className="block font-mono text-[10px] text-text-muted uppercase mb-1">VAT Number</label>
                    <input
                      value={newForm.vatNumber}
                      onChange={(e) => setNewForm({ ...newForm, vatNumber: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="block font-mono text-[10px] text-text-muted uppercase mb-1">Address</label>
                  <input
                    value={newForm.address}
                    onChange={(e) => setNewForm({ ...newForm, address: e.target.value })}
                    className="input-field text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] text-text-muted uppercase mb-1">City</label>
                    <input
                      value={newForm.city}
                      onChange={(e) => setNewForm({ ...newForm, city: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] text-text-muted uppercase mb-1">Postal Code</label>
                    <input
                      value={newForm.postalCode}
                      onChange={(e) => setNewForm({ ...newForm, postalCode: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Extra charge */}
            <div className="border border-border rounded-lg p-3 space-y-2">
              <label className="block font-mono text-[10px] text-text-muted uppercase tracking-wider">Extra Charge (optional)</label>
              <div className="flex gap-2">
                <div className="relative w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-mono">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={extraCharge || ''}
                    onChange={(e) => setExtraCharge(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="input-field text-sm font-mono pl-7"
                  />
                </div>
                <input
                  type="text"
                  value={extraChargeNote}
                  onChange={(e) => setExtraChargeNote(e.target.value)}
                  placeholder="Description (e.g. delivery, rush fee)"
                  className="input-field text-sm flex-1"
                />
              </div>
            </div>

            {/* Preview totals */}
            <div className="bg-bg-tertiary rounded-lg p-3 space-y-1 text-xs font-mono">
              <div className="flex justify-between text-text-secondary">
                <span>Subtotal</span>
                <span>€{subtotal.toFixed(2)}</span>
              </div>
              {discountPct > 0 && (
                <div className="flex justify-between text-accent-green">
                  <span>Discount ({discountPct}%)</span>
                  <span>-€{(subtotal * (discountPct / 100)).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-text-secondary">
                <span>VAT (19%)</span>
                <span>€{((subtotal * (1 - discountPct / 100)) * CYPRUS_VAT_RATE).toFixed(2)}</span>
              </div>
              {extraCharge > 0 && (
                <div className="flex justify-between text-text-secondary">
                  <span>Extra{extraChargeNote ? ` (${extraChargeNote})` : ''}</span>
                  <span>€{extraCharge.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border text-base font-bold">
                <span className="text-text-primary">Total</span>
                <span className="text-accent-amber">€{previewTotal.toFixed(2)}</span>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-xs font-mono text-center">[ {error.toUpperCase()} ]</p>
            )}

            <div className="flex gap-3 pt-2 border-t border-border">
              <button type="button" onClick={onClose} className="btn-outline text-sm py-2 px-4 flex-1">Cancel</button>
              <button
                type="submit"
                disabled={creating || (mode === 'existing' && !selectedCustomer)}
                className="btn-amber flex-1 text-sm py-2 px-4 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={14} /> {creating ? 'Creating...' : 'Create Quotation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
