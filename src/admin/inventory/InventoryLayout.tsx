import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Package, ArrowLeftRight, ScanLine, FileBarChart, Truck } from 'lucide-react'

const tabs = [
  { path: '/admin/inventory', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/inventory/products', label: 'Products', icon: Package },
  { path: '/admin/inventory/movements', label: 'Movements', icon: ArrowLeftRight },
  { path: '/admin/inventory/orders', label: 'Purchase Orders', icon: Truck },
  { path: '/admin/inventory/scan', label: 'Scan', icon: ScanLine },
  { path: '/admin/inventory/reports', label: 'Reports', icon: FileBarChart },
]

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-mono text-2xl font-bold text-text-primary flex items-center gap-2">
            <Package size={24} className="text-accent-amber" /> Inventory
          </h1>
          <p className="text-text-secondary text-sm">3D Fabrication stock control</p>
        </div>
      </div>

      {/* Sub-tabs */}
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

      {/* Content */}
      {children}
    </div>
  )
}
