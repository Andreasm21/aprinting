import { useState, useRef, useEffect } from 'react'
import { Search, User, Building2, X } from 'lucide-react'
import { useCustomersStore, type Customer } from '@/stores/customersStore'

interface Props {
  selectedId?: string
  onSelect: (customer: Customer | null) => void
  /** Allow typing a name without selecting a customer */
  allowFreeText?: boolean
}

export default function CustomerSelector({ selectedId, onSelect }: Props) {
  const customers = useCustomersStore((s) => s.customers)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = selectedId ? customers.find((c) => c.id === selectedId) : null

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = customers.filter((c) => {
    const q = query.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q)
  })

  return (
    <div ref={ref} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 input-field">
          {selected.accountType === 'business' ? <Building2 size={14} className="text-accent-blue" /> : <User size={14} className="text-text-muted" />}
          <span className="text-sm font-mono text-text-primary flex-1 truncate">
            {selected.name} {selected.company && `(${selected.company})`}
          </span>
          <button type="button" onClick={() => { onSelect(null); setQuery('') }} className="p-0.5 hover:bg-bg-secondary rounded">
            <X size={14} className="text-text-muted" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="Search customers..."
            className="input-field pl-9 text-sm"
          />
        </div>
      )}

      {open && !selected && (
        <div className="absolute z-20 mt-1 w-full bg-bg-secondary border border-border rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-text-muted text-xs font-mono">No customers found</div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onSelect(c); setOpen(false); setQuery('') }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-bg-tertiary transition-colors border-b border-border last:border-0"
              >
                {c.accountType === 'business' ? <Building2 size={14} className="text-accent-blue shrink-0" /> : <User size={14} className="text-text-muted shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-mono text-text-primary truncate">{c.name}</div>
                  <div className="text-[11px] text-text-muted truncate">{c.email}{c.company ? ` · ${c.company}` : ''}</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
