import { useState } from 'react'
import {
  Users, Plus, Pencil, Trash2, X, Check, Search,
  Mail, Phone, MapPin, Building2, FileText, ShoppingCart,
  ChevronDown, ChevronUp, Tag
} from 'lucide-react'
import { useCustomersStore, type Customer } from '@/stores/customersStore'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

const TAG_PRESETS = ['VIP', 'B2B', 'Wholesale', 'Recurring', 'Car Parts', 'Prototype', 'New']

function CustomerFormModal({
  initial,
  onSave,
  onClose,
  title,
}: {
  initial: Partial<Customer>
  onSave: (data: Omit<Customer, 'id' | 'createdAt' | 'totalOrders' | 'totalSpent'>) => void
  onClose: () => void
  title: string
}) {
  const [form, setForm] = useState({
    name: initial.name || '',
    email: initial.email || '',
    phone: initial.phone || '',
    company: initial.company || '',
    vatNumber: initial.vatNumber || '',
    address: initial.address || '',
    city: initial.city || '',
    postalCode: initial.postalCode || '',
    notes: initial.notes || '',
    tags: initial.tags || [],
  })

  const toggleTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: form.name,
      email: form.email,
      phone: form.phone,
      company: form.company || undefined,
      vatNumber: form.vatNumber || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      postalCode: form.postalCode || undefined,
      notes: form.notes || undefined,
      tags: form.tags,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bg-secondary border border-border rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-bg-secondary z-10">
          <h2 className="font-mono text-lg font-bold text-text-primary">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X size={20} className="text-text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Full Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" required />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Company</label>
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">VAT Number</label>
              <input value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} className="input-field" placeholder="CY12345678X" />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">City</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Postal Code</label>
              <input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} className="input-field" />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-2">Tags</label>
            <div className="flex flex-wrap gap-2">
              {TAG_PRESETS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-xs font-mono px-2.5 py-1 rounded-full border transition-all ${
                    form.tags.includes(tag)
                      ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/30'
                      : 'border-border text-text-muted hover:border-text-secondary hover:text-text-secondary'
                  }`}
                >
                  {form.tags.includes(tag) && <Check size={10} className="inline mr-1" />}
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field resize-none" rows={2} placeholder="Internal notes about this customer..." />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-outline text-sm py-2 px-4">Cancel</button>
            <button type="submit" className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5">
              <Check size={14} /> Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CustomerRow({ customer }: { customer: Customer }) {
  const [expanded, setExpanded] = useState(false)
  const { updateCustomer, deleteCustomer } = useCustomersStore()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = () => {
    if (confirmDelete) {
      deleteCustomer(customer.id)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-bg-tertiary/50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent-amber/10 border border-accent-amber/20 flex items-center justify-center shrink-0">
              <span className="font-mono text-sm font-bold text-accent-amber">
                {customer.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-mono text-sm text-text-primary">{customer.name}</p>
              <p className="text-text-muted text-xs">{customer.email}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 hidden sm:table-cell">
          {customer.company ? (
            <span className="font-accent text-sm text-text-secondary">{customer.company}</span>
          ) : (
            <span className="text-text-muted text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          <span className="font-accent text-sm text-text-primary">{customer.totalOrders}</span>
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          <span className="font-accent text-sm text-accent-amber">€{customer.totalSpent.toFixed(2)}</span>
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          <div className="flex flex-wrap gap-1">
            {customer.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
                {tag}
              </span>
            ))}
            {customer.tags.length > 3 && (
              <span className="text-[10px] font-mono text-text-muted">+{customer.tags.length - 3}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(true) }}
              className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-amber transition-all"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete() }}
              className={`p-1.5 rounded transition-all ${
                confirmDelete ? 'bg-red-500/10 text-red-400' : 'hover:bg-bg-tertiary text-text-muted hover:text-red-400'
              }`}
              title={confirmDelete ? 'Click again to confirm' : 'Delete'}
            >
              <Trash2 size={14} />
            </button>
            {expanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
          </div>
        </td>
      </tr>

      {/* Expanded details row */}
      {expanded && (
        <tr className="border-b border-border/50 bg-bg-tertiary/30">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="font-mono text-xs text-text-muted uppercase tracking-wider">Contact</h4>
                <div className="space-y-1.5 text-sm">
                  <p className="text-text-secondary flex items-center gap-2"><Mail size={12} className="text-text-muted" /> {customer.email}</p>
                  {customer.phone && <p className="text-text-secondary flex items-center gap-2"><Phone size={12} className="text-text-muted" /> {customer.phone}</p>}
                  {customer.address && (
                    <p className="text-text-secondary flex items-center gap-2">
                      <MapPin size={12} className="text-text-muted" />
                      {customer.address}{customer.city ? `, ${customer.city}` : ''} {customer.postalCode || ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-mono text-xs text-text-muted uppercase tracking-wider">Business</h4>
                <div className="space-y-1.5 text-sm">
                  {customer.company ? (
                    <p className="text-text-secondary flex items-center gap-2"><Building2 size={12} className="text-text-muted" /> {customer.company}</p>
                  ) : (
                    <p className="text-text-muted text-xs">No company info</p>
                  )}
                  {customer.vatNumber && (
                    <p className="text-text-secondary flex items-center gap-2"><FileText size={12} className="text-text-muted" /> VAT: {customer.vatNumber}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-mono text-xs text-text-muted uppercase tracking-wider">Activity</h4>
                <div className="space-y-1.5 text-sm">
                  <p className="text-text-secondary flex items-center gap-2">
                    <ShoppingCart size={12} className="text-text-muted" />
                    {customer.totalOrders} orders • €{customer.totalSpent.toFixed(2)} total
                  </p>
                  <p className="text-text-muted text-xs">
                    Customer since {new Date(customer.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  {customer.lastOrderAt && (
                    <p className="text-text-muted text-xs">Last order: {timeAgo(customer.lastOrderAt)}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Tags */}
            {customer.tags.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 flex-wrap">
                <Tag size={12} className="text-text-muted" />
                {customer.tags.map((tag) => (
                  <span key={tag} className="text-xs font-mono px-2 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Notes */}
            {customer.notes && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="font-mono text-[10px] text-text-muted uppercase mb-1">Notes</p>
                <p className="text-text-secondary text-xs">{customer.notes}</p>
              </div>
            )}
          </td>
        </tr>
      )}

      {/* Edit modal */}
      {editing && (
        <tr className="hidden">
          <td>
            <CustomerFormModal
              title="Edit Customer"
              initial={customer}
              onClose={() => setEditing(false)}
              onSave={(data) => {
                updateCustomer(customer.id, data)
                setEditing(false)
              }}
            />
          </td>
        </tr>
      )}
      {/* Render modal outside table for proper z-index */}
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
    </>
  )
}

export default function AdminCustomers() {
  const { customers, addCustomer } = useCustomersStore()
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  const allTags = [...new Set(customers.flatMap((c) => c.tags))]

  const filtered = customers.filter((c) => {
    const matchesSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.company && c.company.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.includes(search))
    const matchesTag = !tagFilter || c.tags.includes(tagFilter)
    return matchesSearch && matchesTag
  })

  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0)
  const totalOrders = customers.reduce((sum, c) => sum + c.totalOrders, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-mono text-2xl font-bold text-text-primary">Customers</h1>
        <button onClick={() => setAdding(true)} className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5">
          <Plus size={16} /> Add Customer
        </button>
      </div>
      <p className="text-text-secondary text-sm mb-6">Manage customer accounts and track order history.</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card-base p-4 text-center">
          <p className="font-mono text-2xl font-bold text-accent-amber">{customers.length}</p>
          <p className="text-text-muted text-xs font-mono uppercase">Customers</p>
        </div>
        <div className="card-base p-4 text-center">
          <p className="font-mono text-2xl font-bold text-accent-green">{totalOrders}</p>
          <p className="text-text-muted text-xs font-mono uppercase">Total Orders</p>
        </div>
        <div className="card-base p-4 text-center">
          <p className="font-mono text-2xl font-bold text-text-primary">€{totalRevenue.toFixed(0)}</p>
          <p className="text-text-muted text-xs font-mono uppercase">Revenue</p>
        </div>
      </div>

      {/* Search & filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, company, phone..."
            className="input-field pl-10 w-full"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap items-center">
            <button
              onClick={() => setTagFilter(null)}
              className={`text-xs font-mono px-2.5 py-1.5 rounded-full border transition-all ${
                !tagFilter ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/30' : 'border-border text-text-muted hover:text-text-secondary'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                className={`text-xs font-mono px-2.5 py-1.5 rounded-full border transition-all ${
                  tagFilter === tag ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/30' : 'border-border text-text-muted hover:text-text-secondary'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card-base overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-bg-tertiary">
              <th className="text-left font-mono text-xs text-text-muted uppercase tracking-wider px-4 py-3">Customer</th>
              <th className="text-left font-mono text-xs text-text-muted uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Company</th>
              <th className="text-left font-mono text-xs text-text-muted uppercase tracking-wider px-4 py-3 hidden md:table-cell">Orders</th>
              <th className="text-left font-mono text-xs text-text-muted uppercase tracking-wider px-4 py-3 hidden md:table-cell">Spent</th>
              <th className="text-left font-mono text-xs text-text-muted uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Tags</th>
              <th className="text-right font-mono text-xs text-text-muted uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((customer) => (
              <CustomerRow key={customer.id} customer={customer} />
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-muted">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {search || tagFilter ? 'No customers match your search.' : 'No customers yet. They\'ll appear here when orders are placed.'}
            </p>
          </div>
        )}
      </div>

      {/* Add modal */}
      {adding && (
        <CustomerFormModal
          title="Add Customer"
          initial={{}}
          onClose={() => setAdding(false)}
          onSave={(data) => {
            addCustomer(data)
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}
