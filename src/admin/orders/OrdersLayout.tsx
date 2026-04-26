import { Link, useLocation } from 'react-router-dom'
import { ClipboardList, FileText, Receipt } from 'lucide-react'

const tabs = [
  { path: '/admin/orders', label: 'Overview', icon: ClipboardList },
  { path: '/admin/orders/quotations', label: 'Quotations', icon: FileText },
  { path: '/admin/orders/invoices', label: 'Invoices', icon: Receipt },
]

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-mono text-2xl font-bold text-text-primary flex items-center gap-2">
            <ClipboardList size={24} className="text-accent-amber" /> Orders
          </h1>
          <p className="text-text-secondary text-sm">Customer jobs — from quote to delivery</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono transition-all border-b-2 -mb-px whitespace-nowrap ${
                active
                  ? 'border-accent-amber text-accent-amber'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
