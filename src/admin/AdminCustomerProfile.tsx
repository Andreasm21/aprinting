import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Mail, Phone, MapPin, Building2, Tag, Receipt,
  FileText, Edit3, Plus, Eye, Clock, User, ShoppingCart,
  StickyNote, PhoneCall, MailOpen, Handshake, Trash2, Check,
  CreditCard, CalendarDays, TrendingUp, Package, AlertTriangle
} from 'lucide-react'
import { useCustomersStore, DISCOUNT_RATES, type Customer } from '@/stores/customersStore'
import { useInvoicesStore, type Invoice, type DocumentStatus } from '@/stores/invoicesStore'
import { useNotificationsStore, type OrderNotification, type PartRequestNotification } from '@/stores/notificationsStore'
import { useActivitiesStore, type ActivityType } from '@/stores/activitiesStore'
import CustomerFormModal from './components/CustomerFormModal'
import DocumentPreview from './components/DocumentPreview'

type TabKey = 'overview' | 'activity' | 'documents' | 'orders'

const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: 'text-text-muted border-border',
  sent: 'text-accent-blue border-accent-blue/30 bg-accent-blue/5',
  paid: 'text-accent-green border-accent-green/30 bg-accent-green/5',
  cancelled: 'text-red-400 border-red-400/30 bg-red-400/5',
}

const ACTIVITY_CONFIG: Record<ActivityType, { icon: typeof StickyNote; color: string; label: string }> = {
  note: { icon: StickyNote, color: 'text-text-muted bg-bg-tertiary', label: 'Note' },
  call: { icon: PhoneCall, color: 'text-accent-blue bg-accent-blue/10', label: 'Call' },
  email: { icon: MailOpen, color: 'text-accent-amber bg-accent-amber/10', label: 'Email' },
  meeting: { icon: Handshake, color: 'text-accent-green bg-accent-green/10', label: 'Meeting' },
  order: { icon: ShoppingCart, color: 'text-accent-green bg-accent-green/10', label: 'Order' },
  invoice: { icon: Receipt, color: 'text-accent-amber bg-accent-amber/10', label: 'Invoice' },
  quotation: { icon: FileText, color: 'text-accent-blue bg-accent-blue/10', label: 'Quotation' },
  status_change: { icon: TrendingUp, color: 'text-text-muted bg-bg-tertiary', label: 'Status Change' },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(dateStr)
}

// ── Overview Tab ──────────────────────────────────────────

function OverviewTab({ customer }: { customer: Customer }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {/* Contact Info */}
      <div className="card-base p-5 space-y-3">
        <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">Contact Information</h3>
        <div className="space-y-2.5 text-sm">
          <p className="flex items-center gap-2.5 text-text-primary">
            <Mail size={14} className="text-accent-amber shrink-0" /> {customer.email}
          </p>
          <p className="flex items-center gap-2.5 text-text-primary">
            <Phone size={14} className="text-accent-amber shrink-0" /> {customer.phone || '—'}
          </p>
          {customer.address && (
            <p className="flex items-start gap-2.5 text-text-secondary">
              <MapPin size={14} className="text-text-muted shrink-0 mt-0.5" />
              <span>{customer.address}{customer.city ? `, ${customer.city}` : ''}{customer.postalCode ? ` ${customer.postalCode}` : ''}</span>
            </p>
          )}
          {customer.billingAddress && customer.billingAddress !== customer.address && (
            <p className="flex items-start gap-2.5 text-text-secondary">
              <CreditCard size={14} className="text-text-muted shrink-0 mt-0.5" />
              <span className="text-xs">
                <span className="text-text-muted">Billing: </span>
                {customer.billingAddress}{customer.billingCity ? `, ${customer.billingCity}` : ''}{customer.billingPostalCode ? ` ${customer.billingPostalCode}` : ''}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Business Info */}
      <div className="card-base p-5 space-y-3">
        <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">Business Details</h3>
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Account Type</span>
            <span className="text-text-primary capitalize">{customer.accountType}</span>
          </div>
          {customer.company && (
            <div className="flex justify-between">
              <span className="text-text-muted">Company</span>
              <span className="text-text-primary">{customer.company}</span>
            </div>
          )}
          {customer.vatNumber && (
            <div className="flex justify-between">
              <span className="text-text-muted">VAT Number</span>
              <span className="text-text-primary font-mono text-xs">{customer.vatNumber}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-text-muted">Payment Terms</span>
            <span className="text-text-primary">
              {customer.paymentTerms === 'net15' ? 'Net 15' : customer.paymentTerms === 'net30' ? 'Net 30' : customer.paymentTerms === 'net60' ? 'Net 60' : 'Immediate'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Discount Tier</span>
            <span className={`capitalize ${customer.discountTier && customer.discountTier !== 'none' ? 'text-accent-amber font-bold' : 'text-text-primary'}`}>
              {customer.discountTier || 'None'}
              {customer.discountTier && customer.discountTier !== 'none' && ` (${DISCOUNT_RATES[customer.discountTier]}%)`}
            </span>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="card-base p-5">
        <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">Tags</h3>
        {customer.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {customer.tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
                <Tag size={10} /> {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-xs">No tags</p>
        )}
      </div>

      {/* Notes */}
      <div className="card-base p-5">
        <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">Internal Notes</h3>
        {customer.notes ? (
          <p className="text-text-secondary text-sm whitespace-pre-wrap">{customer.notes}</p>
        ) : (
          <p className="text-text-muted text-xs">No notes</p>
        )}
      </div>
    </div>
  )
}

// ── Activity Tab ──────────────────────────────────────────

function ActivityTab({ customer }: { customer: Customer }) {
  const allActivities = useActivitiesStore((s) => s.activities)
  const addActivity = useActivitiesStore((s) => s.addActivity)
  const deleteActivity = useActivitiesStore((s) => s.deleteActivity)
  const activities = useMemo(() => allActivities.filter((a) => a.customerId === customer.id), [allActivities, customer.id])
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<ActivityType>('note')
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')

  const handleSubmit = () => {
    if (!formTitle.trim()) return
    addActivity({
      customerId: customer.id,
      type: formType,
      title: formTitle.trim(),
      description: formDesc.trim(),
      metadata: {},
    })
    setFormTitle('')
    setFormDesc('')
    setShowForm(false)
  }

  const manualTypes: { value: ActivityType; label: string; icon: typeof StickyNote }[] = [
    { value: 'note', label: 'Note', icon: StickyNote },
    { value: 'call', label: 'Call', icon: PhoneCall },
    { value: 'email', label: 'Email', icon: MailOpen },
    { value: 'meeting', label: 'Meeting', icon: Handshake },
  ]

  return (
    <div className="space-y-4">
      {/* Add note button / form */}
      {showForm ? (
        <div className="card-base p-4 space-y-3">
          <div className="flex gap-1.5">
            {manualTypes.map((t) => (
              <button
                key={t.value}
                onClick={() => setFormType(t.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                  formType === t.value
                    ? 'border-accent-amber text-accent-amber bg-accent-amber/5'
                    : 'border-border text-text-muted hover:text-text-secondary'
                }`}
              >
                <t.icon size={12} /> {t.label}
              </button>
            ))}
          </div>
          <input
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Title..."
            className="input-field text-sm"
            autoFocus
          />
          <textarea
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            placeholder="Details (optional)..."
            className="input-field text-sm min-h-[80px] resize-y"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="btn-outline text-xs py-1.5 px-3">Cancel</button>
            <button onClick={handleSubmit} className="btn-amber text-xs py-1.5 px-3 flex items-center gap-1">
              <Check size={12} /> Save
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-xs font-mono text-text-secondary hover:text-accent-amber px-3 py-2 rounded-lg hover:bg-bg-tertiary border border-border transition-all"
        >
          <Plus size={12} /> Add Note
        </button>
      )}

      {/* Timeline */}
      {activities.length === 0 ? (
        <div className="text-center py-10">
          <Clock size={32} className="mx-auto text-text-muted/20 mb-3" />
          <p className="text-text-muted text-sm font-mono">No activity yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {activities.map((a) => {
            const config = ACTIVITY_CONFIG[a.type]
            const Icon = config.icon
            return (
              <div key={a.id} className="flex gap-3 p-3 rounded-lg hover:bg-bg-tertiary/50 transition-colors group">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${config.color}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-primary font-medium">{a.title}</span>
                    <span className="text-[10px] font-mono text-text-muted">{timeAgo(a.createdAt)}</span>
                  </div>
                  {a.description && (
                    <p className="text-text-secondary text-xs mt-0.5 whitespace-pre-wrap">{a.description}</p>
                  )}
                </div>
                {/* Only allow deleting manual entries */}
                {(['note', 'call', 'email', 'meeting'] as ActivityType[]).includes(a.type) && (
                  <button
                    onClick={() => deleteActivity(a.id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Documents Tab ─────────────────────────────────────────

interface DocGroup {
  productName: string
  quotation?: Invoice
  invoice?: Invoice
  standalone: Invoice[]
}

function getProductName(doc: Invoice): string {
  if (doc.lineItems.length > 0) return doc.lineItems[0].description
  return 'Untitled'
}

function findLinkedInvoiceNumber(doc: Invoice): string | null {
  if (!doc.notes) return null
  const m = doc.notes.match(/(?:From |Converted from )(QT-\d{4}-\d{4})/)
  return m ? m[1] : null
}

function buildGroups(docs: Invoice[]): DocGroup[] {
  const groups: DocGroup[] = []
  const used = new Set<string>()

  // First pass: find quotation→invoice pairs via notes
  const quotations = docs.filter((d) => d.type === 'quotation')
  const invs = docs.filter((d) => d.type === 'invoice')

  for (const inv of invs) {
    const linkedQtNum = findLinkedInvoiceNumber(inv)
    if (linkedQtNum) {
      const qt = quotations.find((q) => q.documentNumber === linkedQtNum)
      if (qt && !used.has(qt.id)) {
        groups.push({ productName: getProductName(qt), quotation: qt, invoice: inv, standalone: [] })
        used.add(qt.id)
        used.add(inv.id)
      }
    }
  }

  // Second pass: group remaining docs by product name
  const remaining = docs.filter((d) => !used.has(d.id))
  const byProduct = new Map<string, Invoice[]>()
  for (const doc of remaining) {
    const name = getProductName(doc)
    if (!byProduct.has(name)) byProduct.set(name, [])
    byProduct.get(name)!.push(doc)
  }

  for (const [name, docList] of byProduct) {
    const qt = docList.find((d) => d.type === 'quotation')
    const inv = docList.find((d) => d.type === 'invoice')
    const rest = docList.filter((d) => d !== qt && d !== inv)
    groups.push({ productName: name, quotation: qt, invoice: inv, standalone: rest })
  }

  // Sort by most recent document date
  groups.sort((a, b) => {
    const aDate = (a.invoice || a.quotation || a.standalone[0])?.date || ''
    const bDate = (b.invoice || b.quotation || b.standalone[0])?.date || ''
    return new Date(bDate).getTime() - new Date(aDate).getTime()
  })

  return groups
}

function DocumentsTab({ customer }: { customer: Customer }) {
  const invoices = useInvoicesStore((s) => s.invoices)
  const [previewing, setPreviewing] = useState<Invoice | null>(null)

  const customerDocs = useMemo(() => {
    return invoices.filter((inv) => inv.customerId === customer.id || inv.customerEmail === customer.email)
  }, [invoices, customer])

  const groups = useMemo(() => buildGroups(customerDocs), [customerDocs])

  const totals = useMemo(() => ({
    invoices: customerDocs.filter((i) => i.type === 'invoice').length,
    quotations: customerDocs.filter((i) => i.type === 'quotation').length,
  }), [customerDocs])

  const renderDocRow = (doc: Invoice) => (
    <div key={doc.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-bg-tertiary/30 transition-colors">
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
        <p className="text-[11px] text-text-muted">{formatDate(doc.date)} · €{doc.total.toFixed(2)}</p>
      </div>
      <button onClick={() => setPreviewing(doc)} className="p-1.5 hover:bg-bg-tertiary rounded text-text-muted hover:text-accent-amber">
        <Eye size={14} />
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-3 text-xs font-mono text-text-muted">
        <span>{totals.quotations} quotation{totals.quotations !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span>{totals.invoices} invoice{totals.invoices !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span>{groups.length} product{groups.length !== 1 ? 's' : ''}</span>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-10">
          <FileText size={32} className="mx-auto text-text-muted/20 mb-3" />
          <p className="text-text-muted text-sm font-mono">No documents</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group, i) => (
            <div key={i} className="card-base p-4">
              {/* Product name header */}
              <div className="flex items-center gap-2 mb-3">
                <Package size={14} className="text-accent-amber" />
                <h4 className="font-mono text-sm text-text-primary font-bold truncate">{group.productName}</h4>
                {group.quotation && group.invoice && (
                  <span className="ml-auto text-[10px] font-mono text-accent-green bg-accent-green/10 px-2 py-0.5 rounded-full border border-accent-green/20">
                    Complete
                  </span>
                )}
              </div>

              {/* Document chain */}
              <div className="space-y-1">
                {group.quotation && renderDocRow(group.quotation)}
                {group.quotation && group.invoice && (
                  <div className="flex items-center gap-2 pl-6 py-1">
                    <div className="w-px h-4 bg-border" />
                    <ArrowLeft size={10} className="text-accent-green rotate-[270deg]" />
                    <span className="text-[10px] font-mono text-accent-green">Converted to invoice</span>
                  </div>
                )}
                {group.invoice && renderDocRow(group.invoice)}
                {group.standalone.map((doc) => renderDocRow(doc))}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewing && <DocumentPreview doc={previewing} onClose={() => setPreviewing(null)} />}
    </div>
  )
}

// ── Orders Tab ────────────────────────────────────────────

function OrdersTab({ customer }: { customer: Customer }) {
  const notifications = useNotificationsStore((s) => s.notifications)

  const related = useMemo(() => {
    return notifications.filter((n) => {
      if (n.type === 'order') return (n as OrderNotification).customer.email.toLowerCase() === customer.email.toLowerCase()
      if (n.type === 'part_request') return (n as PartRequestNotification).business.contactEmail.toLowerCase() === customer.email.toLowerCase()
      return false
    })
  }, [notifications, customer])

  if (related.length === 0) {
    return (
      <div className="text-center py-10">
        <ShoppingCart size={32} className="mx-auto text-text-muted/20 mb-3" />
        <p className="text-text-muted text-sm font-mono">No orders or requests</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {related.map((n) => {
        if (n.type === 'order') {
          const o = n as OrderNotification
          return (
            <div key={n.id} className="card-base p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
                  <ShoppingCart size={10} /> Order
                </span>
                <span className="text-text-muted text-xs">{formatDateTime(o.date)}</span>
                <span className="ml-auto font-mono text-sm text-accent-amber font-bold">€{o.total.toFixed(2)}</span>
              </div>
              <div className="space-y-1 text-sm">
                {o.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-text-secondary">
                    <span>{item.name} × {item.quantity}</span>
                    <span>€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        }
        if (n.type === 'part_request') {
          const p = n as PartRequestNotification
          return (
            <div key={n.id} className="card-base p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
                  <Package size={10} /> Part Request
                </span>
                <span className="text-text-muted text-xs">{formatDateTime(p.date)}</span>
              </div>
              <div className="text-sm space-y-1">
                <p className="text-text-primary">{p.details.partName} — {p.details.material}</p>
                <p className="text-text-secondary text-xs">{p.details.vehicleMake} {p.details.vehicleModel} {p.details.vehicleYear} · Qty: {p.details.quantity} · Finish: {p.details.finish}</p>
              </div>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

// ── Main Profile Page ─────────────────────────────────────

export default function AdminCustomerProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const customer = useCustomersStore((s) => s.getCustomerById(id || ''))
  const invoices = useInvoicesStore((s) => s.invoices)
  const [tab, setTab] = useState<TabKey>('overview')
  const [editing, setEditing] = useState(false)
  const updateCustomer = useCustomersStore((s) => s.updateCustomer)

  if (!customer) {
    return (
      <div className="text-center py-20">
        <User size={48} className="mx-auto text-text-muted/20 mb-4" />
        <p className="font-mono text-text-secondary mb-4">Customer not found</p>
        <Link to="/admin/customers" className="btn-outline text-sm py-2 px-4 inline-flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back to Customers
        </Link>
      </div>
    )
  }

  const customerDocs = invoices.filter((inv) => inv.customerId === customer.id || inv.customerEmail === customer.email)
  const avgOrder = customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0
  const initials = customer.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

  const tabs: { key: TabKey; label: string; icon: typeof User; count?: number }[] = [
    { key: 'overview', label: 'Overview', icon: User },
    { key: 'activity', label: 'Activity', icon: Clock },
    { key: 'documents', label: 'Documents', icon: FileText, count: customerDocs.length },
    { key: 'orders', label: 'Orders', icon: ShoppingCart },
  ]

  return (
    <div>
      {/* Back link */}
      <Link to="/admin/customers" className="inline-flex items-center gap-1.5 text-text-muted text-xs font-mono hover:text-accent-amber transition-colors mb-4">
        <ArrowLeft size={12} /> Customers
      </Link>

      {/* Header */}
      <div className="card-base p-6 mb-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-accent-amber/10 flex items-center justify-center shrink-0">
            <span className="font-mono text-xl font-bold text-accent-amber">{initials}</span>
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-mono text-xl font-bold text-text-primary">{customer.name}</h1>
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                customer.accountType === 'business'
                  ? 'text-accent-blue border-accent-blue/30 bg-accent-blue/5'
                  : 'text-text-muted border-border'
              }`}>
                {customer.accountType}
              </span>
              {customer.accountType === 'business' && customer.company && !customer.vatNumber && (
                <span
                  title="Pending VAT number"
                  className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/30"
                >
                  <AlertTriangle size={10} /> NO VAT
                </span>
              )}
            </div>
            {customer.company && (
              <p className="text-text-secondary text-sm flex items-center gap-1.5 mt-0.5">
                <Building2 size={12} className="text-text-muted" /> {customer.company}
              </p>
            )}
            <p className="text-text-muted text-xs mt-1">{customer.email}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setEditing(true)} className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1">
              <Edit3 size={12} /> Edit
            </button>
            <button onClick={() => navigate('/admin/invoices')} className="btn-amber text-xs py-1.5 px-3 flex items-center gap-1">
              <Plus size={12} /> Invoice
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-5 border-t border-border">
          {[
            { label: 'Orders', value: customer.totalOrders.toString(), icon: ShoppingCart },
            { label: 'Total Spent', value: `€${customer.totalSpent.toFixed(2)}`, icon: CreditCard },
            { label: 'Avg Order', value: `€${avgOrder.toFixed(2)}`, icon: TrendingUp },
            { label: 'Customer Since', value: formatDate(customer.createdAt), icon: CalendarDays },
            { label: 'Last Order', value: customer.lastOrderAt ? timeAgo(customer.lastOrderAt) : '—', icon: Clock },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <s.icon size={14} className="mx-auto text-text-muted mb-1" />
              <div className="font-mono text-sm text-text-primary font-bold">{s.value}</div>
              <div className="text-[10px] text-text-muted uppercase font-mono">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border pb-px">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono transition-all border-b-2 -mb-px ${
              tab === t.key
                ? 'border-accent-amber text-accent-amber'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            <t.icon size={14} />
            {t.label}
            {t.count !== undefined && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                tab === t.key ? 'bg-accent-amber/20' : 'bg-bg-tertiary'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab customer={customer} />}
      {tab === 'activity' && <ActivityTab customer={customer} />}
      {tab === 'documents' && <DocumentsTab customer={customer} />}
      {tab === 'orders' && <OrdersTab customer={customer} />}

      {/* Edit modal */}
      {editing && (
        <CustomerFormModal
          title="Edit Customer"
          initial={customer}
          onClose={() => setEditing(false)}
          onSave={(data) => {
            updateCustomer(customer.id, data)
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}
