import { X, Plus, Minus, ShoppingBag, Trash2 } from 'lucide-react'
import { useCartStore, unitPriceFor } from '@/stores/cartStore'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/hooks/useTranslation'

export default function Cart() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, getTotal, keyFor } = useCartStore()
  const { openCheckout } = useAppStore()
  const language = useAppStore((s) => s.language)
  const t = useTranslation()

  const handleCheckout = () => {
    closeCart()
    openCheckout()
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        onClick={closeCart}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-96 z-50 bg-bg-secondary border-l border-border transform transition-transform duration-300 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-mono text-lg font-bold text-text-primary">{t.cart.title}</h2>
          <button onClick={closeCart} className="p-1 hover:bg-bg-tertiary rounded transition-colors">
            <X size={20} className="text-text-muted" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingBag size={48} className="text-text-muted/30 mb-4" />
              <p className="text-text-secondary text-sm">{t.cart.empty}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const name = language === 'gr' ? item.product.nameGr : item.product.name
                return (
                  <div key={item.product.id} className="flex gap-3 bg-bg-tertiary rounded-lg p-3">
                    {/* Thumb placeholder */}
                    <div className="w-14 h-14 bg-bg-primary rounded flex items-center justify-center shrink-0">
                      <ShoppingBag size={18} className="text-text-muted/30" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-bold text-text-primary truncate">{name}</p>
                      <p className="font-accent text-xs text-text-muted">{item.product.material}</p>

                      <div className="flex items-center justify-between mt-2">
                        {/* Qty controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateQuantity(keyFor(item), item.quantity - 1)}
                            className="w-6 h-6 rounded bg-bg-primary border border-border flex items-center justify-center hover:border-accent-amber transition-colors"
                          >
                            <Minus size={12} className="text-text-secondary" />
                          </button>
                          <span className="font-accent text-sm text-text-primary w-6 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(keyFor(item), item.quantity + 1)}
                            className="w-6 h-6 rounded bg-bg-primary border border-border flex items-center justify-center hover:border-accent-amber transition-colors"
                          >
                            <Plus size={12} className="text-text-secondary" />
                          </button>
                        </div>

                        <span className="font-accent text-sm text-accent-amber">
                          €{(unitPriceFor(item) * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => removeItem(keyFor(item))}
                      className="p-1 self-start hover:bg-bg-primary rounded transition-colors"
                    >
                      <Trash2 size={14} className="text-text-muted hover:text-red-400" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-5 border-t border-border space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm text-text-secondary">{t.cart.total}</span>
              <span className="font-mono text-xl font-bold text-accent-amber">€{getTotal().toFixed(2)}</span>
            </div>
            <button onClick={closeCart} className="btn-outline w-full text-sm py-2.5">
              {t.cart.continueShopping}
            </button>
            <button onClick={handleCheckout} className="btn-amber w-full text-sm py-2.5">
              {t.cart.checkout}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
