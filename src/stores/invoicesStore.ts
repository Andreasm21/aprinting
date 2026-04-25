import { create } from 'zustand'
import { useNotificationsStore, type OrderNotification, type PartRequestNotification } from './notificationsStore'
import { useContentStore } from './contentStore'
import { useCustomersStore } from './customersStore'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useActivitiesStore } from './activitiesStore'
import { useAuditLogStore } from './auditLogStore'

export const CYPRUS_VAT_RATE = 0.19

export type DocumentType = 'invoice' | 'quotation'
export type DocumentStatus = 'draft' | 'sent' | 'paid' | 'cancelled'

export interface InvoiceLineItem {
  description: string
  material?: string
  weightGrams?: number
  ratePerGram?: number
  /** @deprecated use printHours + labourHours separately. Kept for legacy reads. */
  hours?: number
  printHours?: number   // printer running time → drives electricity + depreciation
  labourHours?: number  // human work time → drives labour cost
  unitPrice: number
  quantity: number
  total: number
}

export interface Invoice {
  // Optional admin override of the final total. When set, the customer-facing
  // render shows just this number — no subtotal/VAT/discount breakdown.
  totalOverride?: number
  id: string
  type: DocumentType
  documentNumber: string
  date: string
  validUntil?: string
  customerId?: string
  customerName: string
  customerEmail: string
  customerCompany?: string
  customerVatNumber?: string
  billingAddress: string
  billingCity?: string
  billingPostalCode?: string
  lineItems: InvoiceLineItem[]
  subtotal: number
  vatRate: number
  vatAmount: number
  deliveryFee: number
  discountPercent: number
  discountAmount: number
  extraCharge?: number
  extraChargeNote?: string
  total: number
  paymentTerms?: string
  notes?: string
  termsAndConditions?: string
  status: DocumentStatus
  locked?: boolean
  createdAt: string
  sourceOrderId?: string
  sourcePartRequestId?: string
}

interface InvoicesState {
  invoices: Invoice[]
  loading: boolean
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => string
  updateInvoice: (id: string, updates: Partial<Invoice>) => void
  deleteInvoice: (id: string) => void
  getNextNumber: (type: DocumentType) => string
  convertToInvoice: (quotationId: string) => string | null
  createFromOrder: (orderId: string) => string | null
  createQuotationFromPartRequest: (requestId: string) => string | null
}

// ---------------------------------------------------------------------------
// camelCase <-> snake_case conversion helpers
// ---------------------------------------------------------------------------

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/** Convert an Invoice (camelCase) to a Supabase row (snake_case). */
function invoiceToRow(inv: Invoice): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(inv)) {
    row[toSnakeCase(key)] = value
  }
  return row
}

/** Convert a Supabase row (snake_case) to an Invoice (camelCase). */
function rowToInvoice(row: Record<string, unknown>): Invoice {
  const inv: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    inv[toCamelCase(key)] = value
  }
  // Ensure date strings are ISO strings (Supabase returns timestamptz)
  if (typeof inv.date === 'string' && inv.date) {
    inv.date = new Date(inv.date as string).toISOString()
  }
  if (typeof inv.validUntil === 'string' && inv.validUntil) {
    inv.validUntil = new Date(inv.validUntil as string).toISOString()
  }
  if (typeof inv.createdAt === 'string' && inv.createdAt) {
    inv.createdAt = new Date(inv.createdAt as string).toISOString()
  }
  // Coerce numeric fields that Supabase may return as strings
  for (const numField of ['subtotal', 'vatRate', 'vatAmount', 'deliveryFee', 'discountPercent', 'discountAmount', 'total']) {
    if (inv[numField] !== undefined && inv[numField] !== null) {
      inv[numField] = Number(inv[numField])
    }
  }
  return inv as unknown as Invoice
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

async function upsertToSupabase(invoice: Invoice): Promise<void> {
  if (!isSupabaseConfigured) return
  const row = invoiceToRow(invoice)
  const { error } = await supabase.from('documents').upsert(row, { onConflict: 'id' })
  if (error) throw error
}

async function deleteFromSupabase(id: string): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
}

async function fetchFromSupabase(): Promise<void> {
  useInvoicesStore.setState({ loading: true })
  if (!isSupabaseConfigured) {
    useInvoicesStore.setState({ loading: false })
    return
  }
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[invoicesStore] Supabase fetch error:', error)
      useInvoicesStore.setState({ loading: false })
      return
    }
    const rows = (data || []) as Record<string, unknown>[]
    useInvoicesStore.setState({ invoices: rows.map(rowToInvoice), loading: false })
  } catch (err) {
    console.error('[invoicesStore] Supabase fetch exception:', err)
    useInvoicesStore.setState({ loading: false })
  }
}

// ---------------------------------------------------------------------------
// Shared logic
// ---------------------------------------------------------------------------

function calcTotals(lineItems: InvoiceLineItem[], deliveryFee: number, vatRate: number, discountPercent: number, extraCharge = 0) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
  const discountAmount = subtotal * (discountPercent / 100)
  const afterDiscount = subtotal - discountAmount
  const vatAmount = afterDiscount * vatRate
  const total = afterDiscount + vatAmount + deliveryFee + extraCharge
  return { subtotal, discountAmount, vatAmount, total }
}

function getMaterialRate(material: string): number {
  const pricing = useContentStore.getState().content.pricing
  const fdmMatch = pricing.fdm.find((r) => r.material.toLowerCase() === material.toLowerCase())
  if (fdmMatch) return parseFloat(fdmMatch.price.replace('€', ''))
  const resinMatch = pricing.resin.find((r) => r.type.toLowerCase() === material.toLowerCase())
  if (resinMatch) return parseFloat(resinMatch.price.replace('€', ''))
  return 0.05
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useInvoicesStore = create<InvoicesState>((set, get) => {
  return {
    invoices: [],
    loading: true,

    addInvoice: (data) => {
      const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const invoice: Invoice = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
      }
      // Push to local state immediately for snappy UX
      set((state) => ({ invoices: [invoice, ...state.invoices] }))
      // Sync to Supabase (state already updated; log error if it fails)
      void (async () => {
        try {
          await upsertToSupabase(invoice)
        } catch (err) {
          console.error('[invoicesStore] addInvoice Supabase error:', err)
        }
      })()
      // Auto-log activity
      if (data.customerId) {
        const typeLabel = data.type === 'quotation' ? 'Quotation' : 'Invoice'
        useActivitiesStore.getState().addActivity({
          customerId: data.customerId,
          type: data.type === 'quotation' ? 'quotation' : 'invoice',
          title: `${typeLabel} ${data.documentNumber} created`,
          description: `Total: €${data.total.toFixed(2)}`,
          metadata: { documentId: id, documentNumber: data.documentNumber, total: data.total },
        })
      }
      const cat = data.type === 'quotation' ? 'quotation' as const : 'invoice' as const
      useAuditLogStore.getState().log('create', cat, `${data.type === 'quotation' ? 'Quotation' : 'Invoice'} ${data.documentNumber} created`, `€${data.total.toFixed(2)} — ${data.customerName}`)
      return id
    },

    updateInvoice: (id, updates) => {
      let updated: Invoice | undefined
      set((state) => {
        const invoices = state.invoices.map((inv) => {
          if (inv.id === id) {
            updated = { ...inv, ...updates }
            return updated
          }
          return inv
        })
        return { invoices }
      })
      if (updated) {
        const updatedInvoice = updated
        void (async () => {
          try {
            await upsertToSupabase(updatedInvoice)
          } catch (err) {
            console.error('[invoicesStore] updateInvoice Supabase error:', err)
          }
        })()
        if (updates.status) {
          const cat = updated.type === 'quotation' ? 'quotation' as const : 'invoice' as const
          useAuditLogStore.getState().log('status_change', cat, `${updated.documentNumber} → ${updates.status}`, updated.customerName)
        }
        if (updates.locked) {
          useAuditLogStore.getState().log('lock', 'invoice', `${updated.documentNumber} locked`, 'Set to view-only')
        }
      }
    },

    deleteInvoice: (id) => {
      const doc = get().invoices.find((inv) => inv.id === id)
      if (doc) {
        const cat = doc.type === 'quotation' ? 'quotation' as const : 'invoice' as const
        useAuditLogStore.getState().log('delete', cat, `${doc.documentNumber} deleted`, doc.customerName)
      }
      set((state) => ({ invoices: state.invoices.filter((inv) => inv.id !== id) }))
      void (async () => {
        try {
          await deleteFromSupabase(id)
        } catch (err) {
          console.error('[invoicesStore] deleteInvoice Supabase error:', err)
        }
      })()
    },

    getNextNumber: (type) => {
      const prefix = type === 'invoice' ? 'AXM' : 'QT'
      const year = new Date().getFullYear()
      const existing = get().invoices.filter((inv) => inv.type === type && inv.documentNumber.includes(`${year}`))
      const maxNum = existing.reduce((max, inv) => {
        const match = inv.documentNumber.match(/(\d{4})$/)
        return match ? Math.max(max, parseInt(match[1])) : max
      }, 0)
      return `${prefix}-${year}-${String(maxNum + 1).padStart(4, '0')}`
    },

    convertToInvoice: (quotationId) => {
      const quote = get().invoices.find((inv) => inv.id === quotationId && inv.type === 'quotation')
      if (!quote) return null

      const invoiceNumber = get().getNextNumber('invoice')

      const invoiceData: Omit<Invoice, 'id' | 'createdAt'> = {
        type: 'invoice',
        documentNumber: invoiceNumber,
        date: new Date().toISOString(),
        customerId: quote.customerId,
        customerName: quote.customerName,
        customerEmail: quote.customerEmail,
        customerCompany: quote.customerCompany,
        customerVatNumber: quote.customerVatNumber,
        billingAddress: quote.billingAddress,
        billingCity: quote.billingCity,
        billingPostalCode: quote.billingPostalCode,
        lineItems: quote.lineItems,
        subtotal: quote.subtotal,
        vatRate: quote.vatRate,
        vatAmount: quote.vatAmount,
        deliveryFee: quote.deliveryFee,
        discountPercent: quote.discountPercent,
        discountAmount: quote.discountAmount,
        total: quote.total,
        paymentTerms: quote.paymentTerms,
        notes: quote.notes ? `From ${quote.documentNumber}. ${quote.notes}` : `Converted from ${quote.documentNumber}`,
        status: 'draft',
      }

      const invoiceId = get().addInvoice(invoiceData)

      // Mark the quotation as accepted
      get().updateInvoice(quotationId, { status: 'paid' })

      // Auto-log conversion activity
      if (quote.customerId) {
        useActivitiesStore.getState().addActivity({
          customerId: quote.customerId,
          type: 'status_change',
          title: `${quote.documentNumber} accepted → ${invoiceNumber} created`,
          description: `Quotation converted to invoice. Total: €${quote.total.toFixed(2)}`,
          metadata: { quotationId, invoiceId, total: quote.total },
        })
      }

      return invoiceId
    },

    createFromOrder: (orderId) => {
      const notifications = useNotificationsStore.getState().notifications
      const order = notifications.find((n) => n.id === orderId && n.type === 'order') as OrderNotification | undefined
      if (!order) return null

      const customer = useCustomersStore.getState().getCustomerByEmail(order.customer.email)

      const lineItems: InvoiceLineItem[] = order.items.map((item) => ({
        description: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
      }))

      const discountPercent = 0
      const { subtotal, discountAmount, vatAmount, total } = calcTotals(lineItems, order.deliveryFee, CYPRUS_VAT_RATE, discountPercent)

      const data: Omit<Invoice, 'id' | 'createdAt'> = {
        type: 'invoice',
        documentNumber: get().getNextNumber('invoice'),
        date: new Date().toISOString(),
        customerId: customer?.id,
        customerName: order.customer.name,
        customerEmail: order.customer.email,
        customerCompany: customer?.company,
        customerVatNumber: customer?.vatNumber,
        billingAddress: order.customer.address || customer?.billingAddress || customer?.address || '',
        billingCity: order.customer.city || customer?.billingCity || customer?.city,
        billingPostalCode: order.customer.postalCode || customer?.billingPostalCode || customer?.postalCode,
        lineItems,
        subtotal,
        vatRate: CYPRUS_VAT_RATE,
        vatAmount,
        deliveryFee: order.deliveryFee,
        discountPercent,
        discountAmount,
        total,
        paymentTerms: customer?.paymentTerms || 'immediate',
        notes: '',
        status: 'draft',
        sourceOrderId: orderId,
      }

      return get().addInvoice(data)
    },

    createQuotationFromPartRequest: (requestId) => {
      const notifications = useNotificationsStore.getState().notifications
      const request = notifications.find((n) => n.id === requestId && n.type === 'part_request') as PartRequestNotification | undefined
      if (!request) return null

      const rate = getMaterialRate(request.details.material)
      const estimatedWeight = 50 // default estimate in grams
      const basePrice = estimatedWeight * rate

      const lineItems: InvoiceLineItem[] = [
        {
          description: `${request.details.partName} — ${request.details.material}`,
          material: request.details.material,
          weightGrams: estimatedWeight,
          ratePerGram: rate,
          unitPrice: basePrice,
          quantity: request.details.quantity,
          total: basePrice * request.details.quantity,
        },
      ]

      // Add finishing cost if not raw
      if (request.details.finish !== 'raw') {
        const finishLabels: Record<string, string> = { sanded: 'Sanding & Smoothing', painted: 'Painting to Match', coated: 'UV Coating' }
        const finishPrices: Record<string, number> = { sanded: 5, painted: 15, coated: 8 }
        const label = finishLabels[request.details.finish] || 'Finishing'
        const price = finishPrices[request.details.finish] || 5
        lineItems.push({
          description: label,
          unitPrice: price,
          quantity: request.details.quantity,
          total: price * request.details.quantity,
        })
      }

      // Add urgency surcharge
      if (request.details.urgency !== 'standard') {
        const surchargeRate = request.details.urgency === 'rush' ? 0.5 : 0.3
        const baseTotal = lineItems.reduce((s, i) => s + i.total, 0)
        const surcharge = baseTotal * surchargeRate
        lineItems.push({
          description: `Urgency surcharge (${request.details.urgency === 'rush' ? '+50%' : '+30%'})`,
          unitPrice: surcharge,
          quantity: 1,
          total: surcharge,
        })
      }

      const discountPercent = 0
      const { subtotal, discountAmount, vatAmount, total } = calcTotals(lineItems, 0, CYPRUS_VAT_RATE, discountPercent)

      const validUntil = new Date()
      validUntil.setDate(validUntil.getDate() + 30)

      const data: Omit<Invoice, 'id' | 'createdAt'> = {
        type: 'quotation',
        documentNumber: get().getNextNumber('quotation'),
        date: new Date().toISOString(),
        validUntil: validUntil.toISOString(),
        customerName: request.business.contactName,
        customerEmail: request.business.contactEmail,
        customerCompany: request.business.companyName || undefined,
        customerVatNumber: request.business.vatNumber || undefined,
        billingAddress: '',
        lineItems,
        subtotal,
        vatRate: CYPRUS_VAT_RATE,
        vatAmount,
        deliveryFee: 0,
        discountPercent,
        discountAmount,
        total,
        notes: request.details.partDescription || '',
        termsAndConditions: `• This quotation is valid for 30 days from the date of issue.\n• Prices are in EUR and include Cyprus VAT at 19%.\n• Estimated weight is approximate; final pricing may vary ±15% based on actual print weight.\n• Payment is due upon completion unless otherwise agreed.\n• Standard delivery within Cyprus is included for orders over €50.\n• Revisions to the 3D model are limited to 2 rounds; additional revisions at €15/hr.\n• All intellectual property remains with the client.`,
        status: 'draft',
        sourcePartRequestId: requestId,
      }

      return get().addInvoice(data)
    },
  }
})

// Kick off initial Supabase fetch AFTER the store is fully assigned (avoids TDZ).
void fetchFromSupabase()
