import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowRight, ClipboardList, FileText, Receipt, Package, Trash2 } from 'lucide-react'
import { useOrdersStore, ORDER_STATUS_LABEL, type OrderStatus } from '@/stores/ordersStore'
import OrdersLayout from './OrdersLayout'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'text-accent-amber bg-accent-amber/10 border-accent-amber/30',
  in_production: 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
  ready: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  shipped: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  delivered: 'text-accent-green bg-accent-green/10 border-accent-green/30',
  closed: 'text-text-muted bg-bg-tertiary border-border',
  cancelled: 'text-red-400 bg-red-500/10 border-red-500/30',
}

const STATUS_FILTERS: ('all' | OrderStatus)[] = ['all', 'pending', 'in_production', 'ready', 'shipped', 'delivered', 'closed', 'cancelled']

export default function AdminOrdersOverview() {
  const orders = useOrdersStore((s) => s.orders)
  const loading = useOrdersStore((s) => s.loading)
  const deleteOrder = useOrdersStore((s) => s.deleteOrder)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | OrderStatus>('all')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null)

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (status !== 'all' && o.status !== status) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q)
      )
    })
  }, [orders, search, status])

  return (
    <OrdersLayout>
      {/* Filter bar */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders or customers…"
            className="input-field text-sm pl-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-2 rounded text-xs font-mono uppercase whitespace-nowrap ${
                status === s
                  ? 'bg-accent-amber/10 text-accent-amber border border-accent-amber/30'
                  : 'text-text-muted hover:text-text-secondary border border-transparent'
              }`}
            >
              {s === 'all' ? 'All' : ORDER_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {(['pending', 'in_production', 'ready', 'shipped'] as OrderStatus[]).map((s) => {
          const count = orders.filter((o) => o.status === s).length
          return (
            <div key={s} className="card-base p-3">
              <p className="text-[10px] font-mono text-text-muted uppercase">{ORDER_STATUS_LABEL[s]}</p>
              <p className="font-mono text-2xl font-bold text-text-primary mt-0.5">{count}</p>
            </div>
          )
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="card-base p-10 text-center">
          <p className="text-text-muted text-sm font-mono">[ LOADING... ]</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <Package size={32} className="mx-auto text-text-muted/20 mb-3" />
          <p className="text-text-muted text-sm font-mono">[ NO ORDERS YET ]</p>
          <p className="text-text-muted text-xs mt-2">Orders are created automatically when a quotation is accepted.</p>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-tertiary border-b border-border">
              <tr className="text-left text-[10px] font-mono uppercase text-text-muted">
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Quote</th>
                <th className="py-3 px-4">Invoice</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Created</th>
                <th className="py-3 px-4 w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-bg-tertiary/50">
                  <td className="py-3 px-4 font-mono text-accent-amber font-bold text-xs">{o.orderNumber}</td>
                  <td className="py-3 px-4 text-text-primary text-sm">{o.customerName}</td>
                  <td className="py-3 px-4 text-text-muted text-xs font-mono">
                    {o.quotationId ? <span className="inline-flex items-center gap-1"><FileText size={11} /> linked</span> : '—'}
                  </td>
                  <td className="py-3 px-4 text-text-muted text-xs font-mono">
                    {o.invoiceId ? <span className="inline-flex items-center gap-1"><Receipt size={11} /> linked</span> : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-text-primary">€{o.total.toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${STATUS_STYLE[o.status]}`}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-text-muted text-xs font-mono">
                    {new Date(o.createdAt).toLocaleDateString('en-GB')}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={`/admin/orders/${o.id}`}
                        className="p-1.5 rounded text-text-muted hover:text-accent-amber hover:bg-bg-tertiary"
                        title="Open order"
                      >
                        <ArrowRight size={14} />
                      </Link>
                      <button
                        onClick={() => setDeleteTarget({ id: o.id, label: `${o.orderNumber} — ${o.customerName}` })}
                        className="p-1.5 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10"
                        title="Delete order (does NOT delete the linked quote/invoice)"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          label={deleteTarget.label}
          onConfirm={async () => {
            await deleteOrder(deleteTarget.id)
            setDeleteTarget(null)
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <p className="text-[10px] text-text-muted font-mono mt-4 flex items-center gap-1.5">
        <ClipboardList size={11} /> Orders are created automatically when a quotation is converted to invoice (accepted).
      </p>
    </OrdersLayout>
  )
}
