import { useState } from 'react'
import { ShoppingCart, X, Minus, Plus, FileText, Trash2, Calculator } from 'lucide-react'
import { useQuoteCartStore } from '@/stores/quoteCartStore'
import QuoteCustomerPickerModal from './QuoteCustomerPickerModal'
import PrintJobCalculatorModal from './PrintJobCalculatorModal'

export default function QuoteCart() {
  const items = useQuoteCartStore((s) => s.items)
  const isOpen = useQuoteCartStore((s) => s.isOpen)
  const updateQuantity = useQuoteCartStore((s) => s.updateQuantity)
  const removeItem = useQuoteCartStore((s) => s.removeItem)
  const clearCart = useQuoteCartStore((s) => s.clearCart)
  const openCart = useQuoteCartStore((s) => s.openCart)
  const closeCart = useQuoteCartStore((s) => s.closeCart)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)

  const totalCount = items.reduce((s, i) => s + i.quantity, 0)
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  if (totalCount === 0 && !isOpen) return null

  return (
    <>
      {/* Floating cart button */}
      {!isOpen && totalCount > 0 && (
        <button
          onClick={openCart}
          className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-accent-amber text-bg-primary shadow-2xl flex items-center justify-center hover:brightness-110 active:scale-95 transition-all"
          title="Open quote cart"
        >
          <ShoppingCart size={22} />
          <span className="absolute -top-1 -right-1 bg-bg-primary text-accent-amber text-[11px] font-mono font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center border-2 border-accent-amber">
            {totalCount}
          </span>
        </button>
      )}

      {/* Cart Panel */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={closeCart} />
          <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-bg-secondary border-l border-border shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="font-mono text-base font-bold text-text-primary flex items-center gap-2">
                  <ShoppingCart size={16} className="text-accent-amber" /> Quote Cart
                </h2>
                <p className="text-text-muted text-xs font-mono mt-0.5">
                  {items.length} item{items.length !== 1 ? 's' : ''} · {totalCount} unit{totalCount !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={closeCart} className="p-1 hover:bg-bg-tertiary rounded">
                <X size={18} className="text-text-muted" />
              </button>
            </div>

            {/* Quick add a custom print job */}
            <div className="px-4 pt-3">
              <button
                onClick={() => setShowCalculator(true)}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-mono text-text-secondary hover:text-accent-amber px-3 py-2 rounded-lg border border-dashed border-border hover:border-accent-amber transition-all"
              >
                <Calculator size={12} /> + Print Job (calculate price)
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart size={32} className="mx-auto text-text-muted/20 mb-3" />
                  <p className="text-text-muted text-sm font-mono">[ CART EMPTY ]</p>
                  <p className="text-text-muted text-xs mt-2">
                    Click "+ Quote" on any product to add it here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={`${item.source}-${item.productId}`} className="card-base p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
                              item.source === 'inventory' ? 'bg-accent-blue/10 text-accent-blue' : 'bg-accent-amber/10 text-accent-amber'
                            }`}>
                              {item.source}
                            </span>
                            {item.material && (
                              <span className="text-[9px] font-mono uppercase text-text-muted">{item.material}</span>
                            )}
                          </div>
                          <p className="text-sm text-text-primary leading-tight truncate">{item.description}</p>
                          <p className="text-[11px] text-text-muted font-mono mt-0.5">€{item.unitPrice.toFixed(2)} / unit</p>
                        </div>
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="p-1 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 shrink-0"
                          title="Remove"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="w-7 h-7 rounded border border-border hover:border-accent-amber flex items-center justify-center text-text-muted hover:text-accent-amber disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value) || 1)}
                            className="w-12 h-7 bg-bg-tertiary border border-border rounded text-center text-sm font-mono text-text-primary"
                            min={1}
                          />
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="w-7 h-7 rounded border border-border hover:border-accent-amber flex items-center justify-center text-text-muted hover:text-accent-amber"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <span className="font-mono text-sm font-bold text-accent-amber">
                          €{(item.unitPrice * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-border p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted font-mono">Subtotal (ex. VAT)</span>
                  <span className="font-mono text-lg font-bold text-accent-amber">€{subtotal.toFixed(2)}</span>
                </div>
                <p className="text-[10px] text-text-muted font-mono text-center">
                  Cyprus VAT 19% + customer discounts applied at quotation creation
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { if (confirm('Clear all items from cart?')) clearCart() }}
                    className="px-3 py-2.5 rounded-lg border border-border text-text-muted hover:text-red-400 hover:border-red-400 text-xs font-mono transition-all flex items-center gap-1.5"
                  >
                    <Trash2 size={12} /> Clear
                  </button>
                  <button
                    onClick={() => setShowCustomerPicker(true)}
                    className="btn-amber flex-1 text-sm py-2.5 px-4 flex items-center justify-center gap-1.5"
                  >
                    <FileText size={14} /> Create Quotation
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showCustomerPicker && (
        <QuoteCustomerPickerModal
          onClose={() => setShowCustomerPicker(false)}
        />
      )}

      {showCalculator && (
        <PrintJobCalculatorModal onClose={() => setShowCalculator(false)} />
      )}
    </>
  )
}
