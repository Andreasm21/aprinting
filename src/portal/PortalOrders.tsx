import { useMemo } from 'react'
import { ShoppingCart, Package, Clock } from 'lucide-react'
import { usePortalAuthStore } from '@/stores/portalAuthStore'
import { useNotificationsStore, type OrderNotification, type PartRequestNotification } from '@/stores/notificationsStore'

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function PortalOrders() {
  const customer = usePortalAuthStore((s) => s.customer)
  const notifications = useNotificationsStore((s) => s.notifications)

  const orders = useMemo(() => {
    if (!customer) return []
    return notifications.filter((n) => {
      if (n.type === 'order') return (n as OrderNotification).customer.email.toLowerCase() === customer.email.toLowerCase()
      if (n.type === 'part_request') return (n as PartRequestNotification).business.contactEmail.toLowerCase() === customer.email.toLowerCase()
      return false
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [notifications, customer])

  return (
    <div>
      <h1 className="font-mono text-2xl font-bold text-text-primary mb-1">Orders</h1>
      <p className="text-text-secondary text-sm mb-6">Your order history and part requests.</p>

      {orders.length === 0 ? (
        <div className="card-base p-10 text-center">
          <ShoppingCart size={32} className="mx-auto text-text-muted/20 mb-3" />
          <p className="text-text-muted text-sm font-mono">No orders yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((n) => {
            if (n.type === 'order') {
              const o = n as OrderNotification
              return (
                <div key={n.id} className="card-base p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
                      <ShoppingCart size={10} /> Order
                    </span>
                    <span className="text-text-muted text-xs flex items-center gap-1">
                      <Clock size={10} /> {formatDateTime(o.date)}
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
                  <div className="border-t border-border mt-3 pt-3 flex justify-between text-sm">
                    <span className="text-text-muted">Delivery: {o.customer.deliveryType === 'pickup' ? 'Pickup' : 'Delivery'}</span>
                    <span className={o.deliveryFee === 0 ? 'text-accent-green font-mono' : 'text-text-primary font-mono'}>
                      {o.deliveryFee === 0 ? 'Free' : `€${o.deliveryFee.toFixed(2)}`}
                    </span>
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
                      <Package size={10} /> Part Request
                    </span>
                    <span className="text-text-muted text-xs flex items-center gap-1">
                      <Clock size={10} /> {formatDateTime(p.date)}
                    </span>
                    <span className="ml-auto font-mono text-xs text-text-muted">Ref: {p.reference}</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="text-text-primary font-medium">{p.details.partName}</p>
                    <p className="text-text-secondary text-xs">
                      {p.details.vehicleMake} {p.details.vehicleModel} {p.details.vehicleYear} · {p.details.material} · Qty: {p.details.quantity} · Finish: {p.details.finish}
                    </p>
                    {p.details.partDescription && (
                      <p className="text-text-muted text-xs mt-2">{p.details.partDescription}</p>
                    )}
                  </div>
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
