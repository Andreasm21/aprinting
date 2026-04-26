import { Link, useLocation } from 'react-router-dom'
import { ClipboardList, FileText, Printer, Receipt } from 'lucide-react'
import { FulfillmentFlowMap } from '../components/FulfillmentFlow'
import type { FulfillmentPosition } from '@/lib/fulfillmentFlow'

const tabs = [
  { path: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { path: '/admin/orders/quotations', label: 'Quotations', icon: FileText },
  { path: '/admin/orders/print', label: 'Print', icon: Printer },
  { path: '/admin/orders/invoices', label: 'Payment', icon: Receipt },
]

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const active: FulfillmentPosition =
    location.pathname.includes('/quotations')
      ? { kind: 'custom', stage: 'quotation', label: 'Custom · Quotation' }
      : location.pathname.includes('/print')
        ? { kind: 'custom', stage: 'print', label: 'Print' }
        : location.pathname.includes('/invoices')
          ? { kind: 'custom', stage: 'payment', label: 'Payment' }
          : { kind: 'off_the_shelf', stage: 'order', label: 'Orders' }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-mono text-2xl font-bold text-text-primary flex items-center gap-2">
            <ClipboardList size={24} className="text-accent-amber" /> Fulfillment
          </h1>
          <p className="text-text-secondary text-sm">Custom and off-the-shelf work from intake to archive</p>
        </div>
      </div>

      <div className="mb-6">
        <FulfillmentFlowMap active={active} compact />
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
