import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Package, FileText, DollarSign, Info, MessageSquare, Bell, Users, Receipt, Mail, BarChart3,
  Trash2, Edit3, Lock, RotateCcw, Plus, TrendingUp, Clock, Boxes, ClipboardList,
} from 'lucide-react'
import { useContentStore } from '@/stores/contentStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { useCustomersStore } from '@/stores/customersStore'
import { useInvoicesStore } from '@/stores/invoicesStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useOrdersStore } from '@/stores/ordersStore'
import { usePrintJobsStore } from '@/stores/printJobsStore'
import { useAuditLogStore, type AuditAction, type AuditCategory } from '@/stores/auditLogStore'
import { FulfillmentFlowMap } from './components/FulfillmentFlow'
import type { FulfillmentStage } from '@/lib/fulfillmentFlow'

const ACTION_ICONS: Record<AuditAction, typeof Plus> = {
  create: Plus,
  update: Edit3,
  delete: Trash2,
  status_change: TrendingUp,
  convert: FileText,
  lock: Lock,
  login: Users,
  reset: RotateCcw,
}

const CATEGORY_COLORS: Record<AuditCategory, string> = {
  customer: 'text-accent-blue bg-accent-blue/10',
  invoice: 'text-accent-amber bg-accent-amber/10',
  quotation: 'text-accent-blue bg-accent-blue/10',
  order: 'text-purple-400 bg-purple-500/10',
  notification: 'text-accent-green bg-accent-green/10',
  product: 'text-accent-amber bg-accent-amber/10',
  content: 'text-text-muted bg-bg-tertiary',
  system: 'text-red-400 bg-red-400/10',
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
  return new Date(dateStr).toLocaleDateString('en-GB')
}

function RecentActivityFeed() {
  const entries = useAuditLogStore((s) => s.entries)
  const recent = useMemo(() => entries.slice(0, 5), [entries])

  if (recent.length === 0) return null

  return (
    <div className="mt-8 card-base p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={16} className="text-accent-amber" />
        <h3 className="font-mono text-sm font-bold text-text-primary">Recent Activity</h3>
        <Link to="/admin/activity" className="ml-auto text-[10px] font-mono text-accent-amber hover:underline">View all →</Link>
      </div>
      <div className="space-y-1">
        {recent.map((entry) => {
          const Icon = ACTION_ICONS[entry.action] || Edit3
          const color = CATEGORY_COLORS[entry.category] || 'text-text-muted bg-bg-tertiary'
          return (
            <div key={entry.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-bg-tertiary/50 transition-colors">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{entry.label}</p>
                {entry.detail && <p className="text-[11px] text-text-muted truncate">{entry.detail}</p>}
              </div>
              <span className="text-[10px] font-mono text-text-muted shrink-0">{timeAgo(entry.createdAt)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const products = useContentStore((s) => s.products)
  const { notifications, getUnreadCount } = useNotificationsStore()
  const customerCount = useCustomersStore((s) => s.customers.length)
  const allInvoices = useInvoicesStore((s) => s.invoices)
  const invoiceCount = allInvoices.filter((i) => i.type === 'invoice').length
  const quotationCount = allInvoices.filter((i) => i.type === 'quotation').length
  const unread = getUnreadCount()
  const inventoryCount = useInventoryStore((s) => s.products.length)
  const orders = useOrdersStore((s) => s.orders)
  const printJobs = usePrintJobsStore((s) => s.jobs)

  const flowCounts: Partial<Record<FulfillmentStage, number>> = {
    request: notifications.filter((n) => n.type === 'part_request' || n.type === 'contact').length,
    quotation: quotationCount,
    order: orders.filter((o) => o.status === 'pending').length + notifications.filter((n) => n.type === 'order').length,
    print: printJobs.filter((j) => j.status === 'queued' || j.status === 'printing' || j.status === 'paused').length,
    payment: invoiceCount,
    delivery: orders.filter((o) => o.status === 'ready' || o.status === 'shipped' || o.status === 'delivered').length,
    archive: orders.filter((o) => o.status === 'closed' || o.status === 'cancelled').length,
  }

  const cards = [
    { label: 'Fulfillment', count: orders.length, icon: ClipboardList, path: '/admin/orders', color: 'amber' },
    { label: 'Notifications', count: notifications.length, unread, icon: Bell, path: '/admin/notifications', color: 'amber' },
    { label: 'Customers', count: customerCount, icon: Users, path: '/admin/customers', color: 'blue' },
    { label: 'Payment', count: invoiceCount, icon: Receipt, path: '/admin/orders/invoices', color: 'amber' },
    { label: 'Quotations', count: quotationCount, icon: FileText, path: '/admin/orders/quotations', color: 'blue' },
    { label: 'Print', count: printJobs.length, icon: Boxes, path: '/admin/orders/print', color: 'blue' },
    { label: 'Inventory', count: inventoryCount, icon: Boxes, path: '/admin/inventory', color: 'amber' },
    { label: 'Analytics', icon: BarChart3, path: '/admin/analytics', color: 'green' },
    { label: 'Emails', icon: Mail, path: '/admin/emails', color: 'green' },
    { label: 'Products', count: products.length, icon: Package, path: '/admin/products', color: 'amber' },
    { label: 'Hero Section', icon: FileText, path: '/admin/hero', color: 'blue' },
    { label: 'Services', icon: FileText, path: '/admin/services', color: 'amber' },
    { label: 'Pricing', icon: DollarSign, path: '/admin/pricing', color: 'green' },
    { label: 'About', icon: Info, path: '/admin/about', color: 'blue' },
    { label: 'Contact', icon: MessageSquare, path: '/admin/contact', color: 'amber' },
  ]

  return (
    <div>
      <h1 className="font-mono text-2xl font-bold text-text-primary mb-2">Dashboard</h1>
      <p className="text-text-secondary text-sm mb-8">Run the admin platform through the fulfillment flow.</p>

      <div className="mb-6">
        <FulfillmentFlowMap counts={flowCounts} compact />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.path}
            to={card.path}
            className="card-base card-hover group p-5"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
              card.color === 'blue' ? 'bg-accent-blue/10 text-accent-blue'
              : card.color === 'green' ? 'bg-accent-green/10 text-accent-green'
              : 'bg-accent-amber/10 text-accent-amber'
            }`}>
              <card.icon size={20} />
            </div>
            <h3 className="font-mono text-base font-bold text-text-primary group-hover:text-accent-amber transition-colors">
              {card.label}
            </h3>
            {card.count !== undefined && (
              <div className="flex items-center gap-2 mt-1">
                <p className="font-accent text-sm text-text-muted">{card.count} items</p>
                {(card as { unread?: number }).unread ? (
                  <span className="bg-accent-amber text-bg-primary text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full">
                    {(card as { unread?: number }).unread} new
                  </span>
                ) : null}
              </div>
            )}
          </Link>
        ))}
      </div>

      <RecentActivityFeed />
    </div>
  )
}
