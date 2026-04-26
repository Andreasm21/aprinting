import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import {
  Bell, ShoppingCart, Car, MessageSquare, Trash2,
  CheckCheck, ChevronDown, ChevronUp, UserPlus, Receipt, FileText as FileTextIcon,
  Package, Mail, Phone, MapPin, Clock, Building2, FileText, Check, ExternalLink, AlertTriangle,
} from 'lucide-react'
import {
  useNotificationsStore,
  type Notification,
  type OrderNotification,
  type PartRequestNotification,
  type ContactNotification,
  type AdminAlertNotification,
  type NotificationType,
} from '@/stores/notificationsStore'
import { useCustomersStore } from '@/stores/customersStore'
import { useInvoicesStore } from '@/stores/invoicesStore'
import CustomerFormModal from './components/CustomerFormModal'
import DeleteConfirmModal from './components/DeleteConfirmModal'

type FilterType = 'all' | NotificationType

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function TypeBadge({ type }: { type: NotificationType }) {
  const config: Record<NotificationType, { label: string; icon: typeof ShoppingCart; color: string }> = {
    order: { label: 'Order', icon: ShoppingCart, color: 'text-accent-green bg-accent-green/10 border-accent-green/20' },
    part_request: { label: 'Part Request', icon: Car, color: 'text-accent-blue bg-accent-blue/10 border-accent-blue/20' },
    contact: { label: 'Message', icon: MessageSquare, color: 'text-accent-amber bg-accent-amber/10 border-accent-amber/20' },
    admin_alert: { label: 'Alert', icon: Bell, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  }
  const { label, icon: Icon, color } = config[type]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${color}`}>
      <Icon size={12} /> {label}
    </span>
  )
}

function OrderDetail({ n, onCreateAccount, onCreateInvoice }: { n: OrderNotification; onCreateAccount: () => void; onCreateInvoice: () => void }) {
  const existingCustomer = useCustomersStore((s) => s.getCustomerByEmail(n.customer.email))

  return (
    <div className="space-y-4 mt-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="font-mono text-xs text-text-muted uppercase tracking-wider">Customer</h4>
          <div className="space-y-1.5 text-sm">
            <p className="text-text-primary flex items-center gap-2"><Package size={14} className="text-accent-amber" /> {n.customer.name}</p>
            <p className="text-text-secondary flex items-center gap-2"><Mail size={14} className="text-text-muted" /> {n.customer.email}</p>
            <p className="text-text-secondary flex items-center gap-2"><Phone size={14} className="text-text-muted" /> {n.customer.phone}</p>
            {n.customer.deliveryType === 'delivery' && n.customer.address && (
              <p className="text-text-secondary flex items-center gap-2"><MapPin size={14} className="text-text-muted" /> {n.customer.address}, {n.customer.city} {n.customer.postalCode}</p>
            )}
            <p className="text-text-secondary flex items-center gap-2">
              <Package size={14} className="text-text-muted" />
              {n.customer.deliveryType === 'pickup' ? 'Pickup' : 'Delivery'}
            </p>
          </div>
        </div>
        <div>
          <h4 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-2">Items</h4>
          <div className="space-y-1.5">
            {n.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-text-secondary">{item.name} × {item.quantity}</span>
                <span className="font-accent text-text-primary">€{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Subtotal</span>
              <span className="text-text-primary">€{n.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Delivery</span>
              <span className={n.deliveryFee === 0 ? 'text-accent-green' : 'text-text-primary'}>
                {n.deliveryFee === 0 ? 'Free' : `€${n.deliveryFee.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-border pt-2 mt-2">
              <span className="font-mono text-text-primary">Total</span>
              <span className="font-mono text-accent-amber">€{n.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
        {existingCustomer ? (
          <span className="flex items-center gap-1.5 text-xs font-mono text-accent-green px-3 py-1.5 rounded-lg bg-accent-green/5 border border-accent-green/20">
            <Check size={12} /> Customer exists
          </span>
        ) : (
          <button
            onClick={onCreateAccount}
            className="flex items-center gap-1.5 text-xs font-mono text-text-secondary hover:text-accent-amber px-3 py-1.5 rounded-lg hover:bg-bg-tertiary border border-border transition-all"
          >
            <UserPlus size={12} /> Create Account
          </button>
        )}
        <button
          onClick={onCreateInvoice}
          className="flex items-center gap-1.5 text-xs font-mono text-text-secondary hover:text-accent-green px-3 py-1.5 rounded-lg hover:bg-bg-tertiary border border-border transition-all"
        >
          <Receipt size={12} /> Create Invoice
        </button>
      </div>
    </div>
  )
}

function PartRequestDetail({ n, onCreateAccount, onCreateQuotation }: { n: PartRequestNotification; onCreateAccount: () => void; onCreateQuotation: () => void }) {
  const existingCustomer = useCustomersStore((s) => s.getCustomerByEmail(n.business.contactEmail))

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-xs text-text-muted">Ref:</span>
        <span className="font-mono text-sm text-accent-amber">{n.reference}</span>
        <span className="text-text-muted text-xs">• {n.images} photos</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <h4 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Car size={12} /> Vehicle & Part
          </h4>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-sm">
            <span className="text-text-muted">Vehicle:</span>
            <span className="text-text-primary">{n.details.vehicleMake} {n.details.vehicleModel} {n.details.vehicleYear}</span>
            <span className="text-text-muted">Part:</span>
            <span className="text-text-primary">{n.details.partName}</span>
            <span className="text-text-muted">Material:</span>
            <span className="text-text-primary">{n.details.material}</span>
            <span className="text-text-muted">Qty:</span>
            <span className="text-text-primary">{n.details.quantity}</span>
            <span className="text-text-muted">Finish:</span>
            <span className="text-text-primary capitalize">{n.details.finish}</span>
            <span className="text-text-muted">Urgency:</span>
            <span className={`capitalize ${n.details.urgency === 'rush' ? 'text-red-400 font-bold' : n.details.urgency === 'priority' ? 'text-accent-amber' : 'text-text-primary'}`}>{n.details.urgency}</span>
            {n.details.dimensions && (
              <>
                <span className="text-text-muted">Dimensions:</span>
                <span className="text-text-primary">{n.details.dimensions}</span>
              </>
            )}
          </div>
          {n.details.partDescription && (
            <p className="text-text-secondary text-xs mt-3 border-t border-border pt-2">{n.details.partDescription}</p>
          )}
        </div>
        <div>
          <h4 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Building2 size={12} /> Business Contact
          </h4>
          <div className="space-y-1.5 text-sm">
            {n.business.companyName && <p className="text-text-primary font-accent">{n.business.companyName}</p>}
            {n.business.vatNumber && <p className="text-text-muted text-xs">VAT: {n.business.vatNumber}</p>}
            <p className="text-text-secondary flex items-center gap-2"><Package size={12} className="text-text-muted" /> {n.business.contactName}</p>
            <p className="text-text-secondary flex items-center gap-2"><Mail size={12} className="text-text-muted" /> {n.business.contactEmail}</p>
            {n.business.contactPhone && <p className="text-text-secondary flex items-center gap-2"><Phone size={12} className="text-text-muted" /> {n.business.contactPhone}</p>}
            {n.business.notes && <p className="text-text-muted text-xs border-t border-border pt-2 mt-2">{n.business.notes}</p>}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
        {existingCustomer ? (
          <span className="flex items-center gap-1.5 text-xs font-mono text-accent-green px-3 py-1.5 rounded-lg bg-accent-green/5 border border-accent-green/20">
            <Check size={12} /> Customer exists
          </span>
        ) : (
          <button
            onClick={onCreateAccount}
            className="flex items-center gap-1.5 text-xs font-mono text-text-secondary hover:text-accent-blue px-3 py-1.5 rounded-lg hover:bg-bg-tertiary border border-border transition-all"
          >
            <UserPlus size={12} /> Create B2B Account
          </button>
        )}
        <button
          onClick={onCreateQuotation}
          className="flex items-center gap-1.5 text-xs font-mono text-text-secondary hover:text-accent-amber px-3 py-1.5 rounded-lg hover:bg-bg-tertiary border border-border transition-all"
        >
          <FileTextIcon size={12} /> Create Quotation
        </button>
      </div>
    </div>
  )
}

function AdminAlertDetail({ n }: { n: AdminAlertNotification }) {
  const KIND_ICON = {
    quote_accepted: Check,
    quote_changes_requested: MessageSquare,
    account_requested: UserPlus,
    invoice_paid_cleanup: AlertTriangle,
    other: Bell,
  }
  const KIND_COLOR: Record<AdminAlertNotification['kind'], string> = {
    quote_accepted: 'text-accent-green',
    quote_changes_requested: 'text-accent-amber',
    account_requested: 'text-accent-blue',
    invoice_paid_cleanup: 'text-accent-amber',
    other: 'text-text-muted',
  }
  const Icon = KIND_ICON[n.kind] || Bell
  const archiveQuote = useInvoicesStore((s) => s.updateInvoice)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [archived, setArchived] = useState(false)

  return (
    <div className="space-y-3 mt-4">
      <div className="bg-bg-tertiary rounded-lg p-4 space-y-2">
        <div className={`flex items-center gap-2 text-xs font-mono uppercase ${KIND_COLOR[n.kind]}`}>
          <Icon size={14} /> {n.kind.replace(/_/g, ' ')}
        </div>
        <p className="text-text-primary text-sm whitespace-pre-wrap">{n.message}</p>
      </div>

      {/* Context details */}
      {n.context && Object.values(n.context).some(Boolean) && (
        <div className="space-y-1.5 text-xs font-mono text-text-secondary">
          {n.context.customerName && <div className="flex gap-2"><span className="text-text-muted w-20">Customer:</span><span>{n.context.customerName}</span></div>}
          {n.context.customerEmail && <div className="flex gap-2"><span className="text-text-muted w-20">Email:</span><span>{n.context.customerEmail}</span></div>}
          {n.context.quoteNumber && <div className="flex gap-2"><span className="text-text-muted w-20">Quote:</span><span className="text-accent-amber">{n.context.quoteNumber}</span></div>}
          {n.context.invoiceNumber && <div className="flex gap-2"><span className="text-text-muted w-20">Invoice:</span><span className="text-accent-amber">{n.context.invoiceNumber}</span></div>}
          {n.context.orderNumber && <div className="flex gap-2"><span className="text-text-muted w-20">Order:</span><span className="text-accent-amber">{n.context.orderNumber}</span></div>}
        </div>
      )}

      {/* Action buttons specific to each alert kind */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
        {n.context?.quoteId && (
          <Link to={`/quote/${n.context.quoteId}`} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs font-mono text-text-secondary hover:text-accent-amber px-3 py-1.5 rounded-lg hover:bg-bg-tertiary border border-border transition-all">
            <ExternalLink size={12} /> View public quote
          </Link>
        )}
        {n.context?.invoiceId && (
          <Link to={`/admin/orders/invoices`} className="flex items-center gap-1.5 text-xs font-mono text-text-secondary hover:text-accent-amber px-3 py-1.5 rounded-lg hover:bg-bg-tertiary border border-border transition-all">
            <Receipt size={12} /> Open invoices
          </Link>
        )}
        {n.kind === 'invoice_paid_cleanup' && n.context?.quoteId && !archived && (
          <button
            onClick={() => setConfirmArchive(true)}
            className="flex items-center gap-1.5 text-xs font-mono text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 border border-red-400/30 transition-all"
            title="Cancel the quote so the public link no longer works"
          >
            <Trash2 size={12} /> Archive public quote
          </button>
        )}
        {archived && (
          <span className="flex items-center gap-1.5 text-xs font-mono text-accent-green px-3 py-1.5 rounded-lg bg-accent-green/5 border border-accent-green/20">
            <Check size={12} /> Public link archived
          </span>
        )}
      </div>

      {confirmArchive && n.context?.quoteId && (
        <DeleteConfirmModal
          quick
          verb="Archive"
          label={`Public link for ${n.context.quoteNumber || n.context.quoteId}`}
          onConfirm={async () => {
            archiveQuote(n.context!.quoteId!, { status: 'cancelled' })
            setArchived(true)
            setConfirmArchive(false)
          }}
          onCancel={() => setConfirmArchive(false)}
        />
      )}
    </div>
  )
}

function ContactDetail({ n, onCreateAccount }: { n: ContactNotification; onCreateAccount: () => void }) {
  const existingCustomer = useCustomersStore((s) => s.getCustomerByEmail(n.email))

  return (
    <div className="space-y-3 mt-4">
      <div className="space-y-2 text-sm">
        <p className="text-text-primary flex items-center gap-2"><Package size={14} className="text-accent-amber" /> {n.name}</p>
        <p className="text-text-secondary flex items-center gap-2"><Mail size={14} className="text-text-muted" /> {n.email}</p>
        {n.service && (
          <p className="text-text-secondary flex items-center gap-2"><FileText size={14} className="text-text-muted" /> Service: {n.service}</p>
        )}
      </div>
      <div className="bg-bg-tertiary rounded-lg p-4">
        <p className="font-mono text-xs text-text-muted uppercase mb-2">Message</p>
        <p className="text-text-primary text-sm whitespace-pre-wrap">{n.message}</p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
        {existingCustomer ? (
          <span className="flex items-center gap-1.5 text-xs font-mono text-accent-green px-3 py-1.5 rounded-lg bg-accent-green/5 border border-accent-green/20">
            <Check size={12} /> Customer exists
          </span>
        ) : (
          <button
            onClick={onCreateAccount}
            className="flex items-center gap-1.5 text-xs font-mono text-text-secondary hover:text-accent-amber px-3 py-1.5 rounded-lg hover:bg-bg-tertiary border border-border transition-all"
          >
            <UserPlus size={12} /> Create Customer
          </button>
        )}
      </div>
    </div>
  )
}

function NotificationCard({ notification, onDelete }: { notification: Notification; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const markRead = useNotificationsStore((s) => s.markRead)
  const addCustomer = useCustomersStore((s) => s.addCustomer)
  const createFromOrder = useInvoicesStore((s) => s.createFromOrder)
  const createQuotation = useInvoicesStore((s) => s.createQuotationFromPartRequest)
  const navigate = useNavigate()

  const handleExpand = () => {
    if (!expanded && !notification.read) {
      markRead(notification.id)
    }
    setExpanded(!expanded)
  }

  const handleCreateInvoice = () => {
    const id = createFromOrder(notification.id)
    if (id) navigate('/admin/invoices')
  }

  const handleCreateQuotation = () => {
    const id = createQuotation(notification.id)
    if (id) navigate('/admin/quotations')
  }

  const getCustomerFormInitial = () => {
    if (notification.type === 'order') {
      const n = notification as OrderNotification
      return {
        accountType: 'individual' as const,
        name: n.customer.name,
        email: n.customer.email,
        phone: n.customer.phone,
        address: n.customer.address,
        city: n.customer.city,
        postalCode: n.customer.postalCode,
        tags: [] as string[],
      }
    }
    if (notification.type === 'part_request') {
      const n = notification as PartRequestNotification
      return {
        accountType: 'business' as const,
        name: n.business.contactName,
        email: n.business.contactEmail,
        phone: n.business.contactPhone,
        company: n.business.companyName,
        vatNumber: n.business.vatNumber,
        tags: ['B2B'],
      }
    }
    if (notification.type === 'contact') {
      const n = notification as ContactNotification
      return {
        accountType: 'individual' as const,
        name: n.name,
        email: n.email,
        phone: '',
        tags: [] as string[],
      }
    }
    return {}
  }

  const title = notification.type === 'order'
    ? `New Order — €${(notification as OrderNotification).total.toFixed(2)}`
    : notification.type === 'part_request'
    ? `Part Request — ${(notification as PartRequestNotification).details.partName}`
    : notification.type === 'admin_alert'
    ? (notification as AdminAlertNotification).title
    : `Message from ${(notification as ContactNotification).name}`

  return (
    <div className={`card-base transition-all ${!notification.read ? 'border-accent-amber/30 bg-accent-amber/[0.02]' : ''}`}>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-bg-tertiary/50 transition-colors rounded-lg"
        onClick={handleExpand}
      >
        {!notification.read && (
          <div className="w-2.5 h-2.5 rounded-full bg-accent-amber shrink-0 animate-pulse" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <TypeBadge type={notification.type} />
            <span className="text-text-muted text-xs flex items-center gap-1">
              <Clock size={10} /> {timeAgo(notification.date)}
            </span>
          </div>
          <p className="font-mono text-sm text-text-primary truncate">{title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border mx-4">
          <p className="text-text-muted text-xs mt-3">{formatDate(notification.date)}</p>
          {notification.type === 'order' && (
            <OrderDetail
              n={notification as OrderNotification}
              onCreateAccount={() => setShowCustomerForm(true)}
              onCreateInvoice={handleCreateInvoice}
            />
          )}
          {notification.type === 'part_request' && (
            <PartRequestDetail
              n={notification as PartRequestNotification}
              onCreateAccount={() => setShowCustomerForm(true)}
              onCreateQuotation={handleCreateQuotation}
            />
          )}
          {notification.type === 'contact' && (
            <ContactDetail
              n={notification as ContactNotification}
              onCreateAccount={() => setShowCustomerForm(true)}
            />
          )}
          {notification.type === 'admin_alert' && (
            <AdminAlertDetail n={notification as AdminAlertNotification} />
          )}
        </div>
      )}

      {showCustomerForm && (
        <CustomerFormModal
          title={notification.type === 'part_request' ? 'Create Business Account' : 'Create Customer Account'}
          initial={getCustomerFormInitial()}
          onClose={() => setShowCustomerForm(false)}
          onSave={(data) => {
            addCustomer(data)
            setShowCustomerForm(false)
          }}
        />
      )}
    </div>
  )
}

export default function AdminNotifications() {
  const { notifications, markAllRead, deleteNotification, clearAll, getUnreadCount } = useNotificationsStore()
  const [filter, setFilter] = useState<FilterType>('all')
  const [confirmClear, setConfirmClear] = useState(false)

  const unread = getUnreadCount()
  const filtered = filter === 'all' ? notifications : notifications.filter((n) => n.type === filter)

  const counts = {
    all: notifications.length,
    order: notifications.filter((n) => n.type === 'order').length,
    part_request: notifications.filter((n) => n.type === 'part_request').length,
    contact: notifications.filter((n) => n.type === 'contact').length,
    admin_alert: notifications.filter((n) => n.type === 'admin_alert').length,
  }

  const handleClear = () => {
    if (confirmClear) {
      clearAll()
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold text-text-primary">Notifications</h1>
          {unread > 0 && (
            <span className="bg-accent-amber text-bg-primary text-xs font-bold font-mono px-2.5 py-1 rounded-full">
              {unread} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs font-mono text-text-secondary hover:text-accent-amber transition-colors px-3 py-1.5 rounded-lg hover:bg-bg-tertiary"
            >
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={handleClear}
              className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg transition-all ${
                confirmClear
                  ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                  : 'text-text-muted hover:text-red-400 hover:bg-bg-tertiary'
              }`}
            >
              <Trash2 size={14} /> {confirmClear ? 'Click to confirm' : 'Clear all'}
            </button>
          )}
        </div>
      </div>
      <p className="text-text-secondary text-sm mb-6">Orders, custom part requests, and contact form messages.</p>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {([
          { key: 'all' as FilterType, label: 'All', icon: Bell },
          { key: 'admin_alert' as FilterType, label: 'Alerts', icon: AlertTriangle },
          { key: 'order' as FilterType, label: 'Orders', icon: ShoppingCart },
          { key: 'part_request' as FilterType, label: 'Part Requests', icon: Car },
          { key: 'contact' as FilterType, label: 'Messages', icon: MessageSquare },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs transition-all whitespace-nowrap ${
              filter === key
                ? 'bg-accent-amber/10 text-accent-amber border border-accent-amber/30'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-transparent'
            }`}
          >
            <Icon size={14} />
            {label}
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
              filter === key ? 'bg-accent-amber/20' : 'bg-bg-tertiary'
            }`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Bell size={48} className="mx-auto text-text-muted/20 mb-4" />
            <p className="font-mono text-text-secondary mb-1">No notifications yet</p>
            <p className="text-text-muted text-sm">
              Orders, part requests, and contact messages will appear here.
            </p>
          </div>
        ) : (
          filtered.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              onDelete={() => deleteNotification(n.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
