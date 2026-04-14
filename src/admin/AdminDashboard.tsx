import { Link } from 'react-router-dom'
import { Package, FileText, DollarSign, Info, MessageSquare, Bell, Users, Receipt, Mail, BookOpen } from 'lucide-react'
import { useContentStore } from '@/stores/contentStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { useCustomersStore } from '@/stores/customersStore'
import { useInvoicesStore } from '@/stores/invoicesStore'
import { usePotionStore } from '@/stores/potionStore'

export default function AdminDashboard() {
  const products = useContentStore((s) => s.products)
  const { notifications, getUnreadCount } = useNotificationsStore()
  const customerCount = useCustomersStore((s) => s.customers.length)
  const allInvoices = useInvoicesStore((s) => s.invoices)
  const invoiceCount = allInvoices.filter((i) => i.type === 'invoice').length
  const quotationCount = allInvoices.filter((i) => i.type === 'quotation').length
  const potionPageCount = Object.keys(usePotionStore.getState().pages).length
  const unread = getUnreadCount()

  const cards = [
    { label: 'Notifications', count: notifications.length, unread, icon: Bell, path: '/admin/notifications', color: 'amber' },
    { label: 'Customers', count: customerCount, icon: Users, path: '/admin/customers', color: 'blue' },
    { label: 'Invoices', count: invoiceCount, icon: Receipt, path: '/admin/invoices', color: 'amber' },
    { label: 'Quotations', count: quotationCount, icon: FileText, path: '/admin/quotations', color: 'blue' },
    { label: 'Emails', icon: Mail, path: '/admin/emails', color: 'green' },
    { label: 'Potion', count: potionPageCount, icon: BookOpen, path: '/admin/potion', color: 'amber' },
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
      <p className="text-text-secondary text-sm mb-8">Manage your APrinting website content.</p>

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

      <div className="mt-10 card-base p-5">
        <h3 className="font-mono text-sm font-bold text-text-primary mb-2">Quick Tips</h3>
        <ul className="text-text-secondary text-sm space-y-1.5">
          <li>- All changes save automatically to your browser's local storage.</li>
          <li>- Click "View Site" in the sidebar to see your changes live.</li>
          <li>- Use "Reset All Data" to restore original defaults.</li>
          <li>- Products and content persist between browser sessions.</li>
        </ul>
      </div>
    </div>
  )
}
