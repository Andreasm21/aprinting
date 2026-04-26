import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart, Package, Clock, ArrowRight, Receipt, FileText, Sparkles, Truck, Check, ClipboardList, X as XIcon } from 'lucide-react'
import { usePortalAuthStore } from '@/stores/portalAuthStore'
import { useOrdersStore, ORDER_STATUS_LABEL, type OrderStatus } from '@/stores/ordersStore'
import { useNotificationsStore, type OrderNotification, type PartRequestNotification } from '@/stores/notificationsStore'
import { useInvoicesStore } from '@/stores/invoicesStore'

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PortalOrders() {
  const customer = usePortalAuthStore((s) => s.customer)
  const orders = useOrdersStore((s) => s.orders)
  const ordersLoading = useOrdersStore((s) => s.loading)
  const invoices = useInvoicesStore((s) => s.invoices)
  const notifications = useNotificationsStore((s) => s.notifications)

  // Real Orders linked to this customer (id match, falling back to email).
  const myOrders = useMemo(() => {
    if (!customer) return []
    return orders
      .filter((o) => {
        if (o.customerId === customer.id) return true
        // Fallback: match via the linked invoice's customer email.
        const inv = o.invoiceId ? invoices.find((i) => i.id === o.invoiceId) : undefined
        return inv?.customerEmail?.toLowerCase() === customer.email.toLowerCase()
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [orders, invoices, customer])

  // Legacy: storefront orders + part requests still arrive via notifications.
  const legacyEntries = useMemo(() => {
    if (!customer) return []
    return notifications.filter((n) => {
      if (n.type === 'order') return (n as OrderNotification).customer.email.toLowerCase() === customer.email.toLowerCase()
      if (n.type === 'part_request') return (n as PartRequestNotification).business.contactEmail.toLowerCase() === customer.email.toLowerCase()
      return false
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [notifications, customer])

  const isEmpty = myOrders.length === 0 && legacyEntries.length === 0

  return (
    <div>
      <h1 className="font-mono text-2xl font-bold text-text-primary mb-1">Orders</h1>
      <p className="text-text-secondary text-sm mb-6">Track your orders from quote to delivery.</p>

      {ordersLoading ? (
        <div className="card-base p-10 text-center">
          <p className="text-text-muted text-sm font-mono">[ LOADING... ]</p>
        </div>
      ) : isEmpty ? (
        <div className="card-base p-10 text-center">
          <ShoppingCart size={32} className="mx-auto text-text-muted/20 mb-3" />
          <p className="text-text-muted text-sm font-mono">No orders yet</p>
          <p className="text-text-muted text-xs mt-2">Your accepted quotes will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Real orders (post-quote-acceptance flow) */}
          {myOrders.map((o) => {
            const Icon = STATUS_ICON[o.status]
            const currentIdx = PIPELINE.indexOf(o.status)
            const isCancelled = o.status === 'cancelled'
            const invoice = o.invoiceId ? invoices.find((i) => i.id === o.invoiceId) : undefined

            return (
              <div key={o.id} className="card-base p-5">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-accent-amber">{o.orderNumber}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${STATUS_TINT[o.status]}`}>
                      <Icon size={10} /> {ORDER_STATUS_LABEL[o.status]}
                    </span>
                  </div>
                  <span className="text-text-muted text-[11px] flex items-center gap-1">
                    <Clock size={10} /> {formatDate(o.createdAt)}
                  </span>
                  <span className="ml-auto font-mono text-base text-accent-amber font-bold">€{o.total.toFixed(2)}</span>
                </div>

                {/* Mini progress pipeline */}
                {!isCancelled && (
                  <div className="mb-4 px-1">
                    <div className="flex items-center justify-between gap-1">
                      {PIPELINE.map((s, i) => {
                        const StepIcon = STATUS_ICON[s]
                        const reached = currentIdx >= i
                        return (
                          <div key={s} className="flex-1 flex flex-col items-center">
                            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${
                              reached ? STATUS_TINT[s] : 'border-border bg-bg-tertiary text-text-muted'
                            }`}>
                              <StepIcon size={11} />
                            </div>
                            <p className={`text-[9px] font-mono uppercase mt-1.5 text-center leading-tight ${reached ? 'text-text-secondary' : 'text-text-muted'}`}>
                              {ORDER_STATUS_LABEL[s]}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Invoice + tracking actions */}
                <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-border">
                  {invoice && (
                    <span className="text-[11px] font-mono text-text-muted flex items-center gap-1">
                      <Receipt size={11} /> {invoice.documentNumber}
                    </span>
                  )}
                  {o.quotationId && (
                    <span className="text-[11px] font-mono text-text-muted flex items-center gap-1">
                      <FileText size={11} /> Quote linked
                    </span>
                  )}
                  <Link
                    to={`/track/${o.id}`}
                    className="ml-auto text-xs font-mono text-accent-amber hover:text-accent-amber/80 px-3 py-1.5 rounded-lg border border-accent-amber/40 hover:bg-accent-amber/10 flex items-center gap-1.5"
                  >
                    Open tracking <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )
          })}

          {/* Legacy storefront orders + part requests (kept for back-compat) */}
          {legacyEntries.map((n) => {
            if (n.type === 'order') {
              const o = n as OrderNotification
              return (
                <div key={n.id} className="card-base p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
                      <ShoppingCart size={10} /> Storefront order
                    </span>
                    <span className="text-text-muted text-xs flex items-center gap-1">
                      <Clock size={10} /> {formatDate(o.date)}
                    </span>
                    <span className="ml-auto font-mono text-base text-accent-amber font-bold">€{o.total.toFixed(2)}</span>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {o.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-text-secondary">
                        <span>{item.name} × {item.quantity}</span>
                        <span className="font-mono">€{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
            if (n.type === 'part_request') {
              const p = n as PartRequestNotification
              return (
                <div key={n.id} className="card-base p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
                      <Package size={10} /> Part request
                    </span>
                    <span className="text-text-muted text-xs flex items-center gap-1">
                      <Clock size={10} /> {formatDate(p.date)}
                    </span>
                    <span className="ml-auto font-mono text-xs text-text-muted">Ref: {p.reference}</span>
                  </div>
                  <p className="text-text-primary text-sm font-medium">{p.details.partName}</p>
                </div>
              )
            }
            return null
          })}
        </div>
      )}
    </div>
  )
}
