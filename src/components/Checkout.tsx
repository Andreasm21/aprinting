import { useState } from 'react'
import { X, Check, CreditCard, ShoppingBag, ArrowLeft, ArrowRight, Package, Truck } from 'lucide-react'
import { useCartStore, unitPriceFor } from '@/stores/cartStore'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/hooks/useTranslation'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { useCustomersStore } from '@/stores/customersStore'
import type { CustomerInfo } from '@/types'

export default function Checkout() {
  const t = useTranslation()
  const { showCheckout, checkoutStep, setCheckoutStep, closeCheckout } = useAppStore()
  const { items, getTotal, clearCart, updateQuantity, removeItem, keyFor } = useCartStore()
  const language = useAppStore((s) => s.language)

  const [info, setInfo] = useState<CustomerInfo>({
    name: '',
    email: '',
    phone: '',
    deliveryType: 'delivery',
    address: '',
    city: '',
    postalCode: '',
  })

  if (!showCheckout) return null

  const subtotal = getTotal()
  const deliveryFee = info.deliveryType === 'pickup' ? 0 : subtotal >= 50 ? 0 : 5
  const total = subtotal + deliveryFee

  const steps = [t.checkout.step1, t.checkout.step2, t.checkout.step3, t.checkout.step4]

  const canProceedStep2 = info.name && info.email && info.phone &&
    (info.deliveryType === 'pickup' || (info.address && info.city && info.postalCode))

  const addOrder = useNotificationsStore((s) => s.addOrder)
  const recordOrder = useCustomersStore((s) => s.recordOrder)

  const handlePlaceOrder = () => {
    recordOrder(
      info.email, info.name, info.phone, total,
      info.address || undefined, info.city || undefined, info.postalCode || undefined
    )
    addOrder({
      customer: {
        name: info.name,
        email: info.email,
        phone: info.phone,
        deliveryType: info.deliveryType,
        address: info.address || undefined,
        city: info.city || undefined,
        postalCode: info.postalCode || undefined,
      },
      items: items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
      })),
      subtotal,
      deliveryFee,
      total,
    })
    setCheckoutStep(4)
    clearCart()
  }

  const handleClose = () => {
    closeCheckout()
    if (checkoutStep === 4) {
      document.querySelector('#products')?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="bg-bg-secondary border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-bg-secondary z-10">
          <h2 className="font-mono text-lg font-bold text-text-primary">
            {checkoutStep === 4 ? t.checkout.confirmTitle : t.checkout.step1}
          </h2>
          <button onClick={handleClose} className="p-1 hover:bg-bg-tertiary rounded transition-colors">
            <X size={20} className="text-text-muted" />
          </button>
        </div>

        {/* Step indicator */}
        {checkoutStep < 4 && (
          <div className="flex items-center gap-1 px-5 py-4">
            {steps.slice(0, 3).map((label, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className={`flex items-center gap-2 ${i + 1 <= checkoutStep ? 'text-accent-amber' : 'text-text-muted'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold border-2 ${
                    i + 1 < checkoutStep ? 'bg-accent-amber border-accent-amber text-bg-primary'
                    : i + 1 === checkoutStep ? 'border-accent-amber text-accent-amber'
                    : 'border-border text-text-muted'
                  }`}>
                    {i + 1 < checkoutStep ? <Check size={14} /> : i + 1}
                  </div>
                  <span className="text-xs font-mono hidden sm:inline">{label}</span>
                </div>
                {i < 2 && <div className={`flex-1 h-[2px] mx-2 ${i + 1 < checkoutStep ? 'bg-accent-amber' : 'bg-border'}`} />}
              </div>
            ))}
          </div>
        )}

        <div className="p-5">
          {/* Step 1 — Cart review */}
          {checkoutStep === 1 && (
            <div className="space-y-3">
              {items.map((item) => {
                const name = language === 'gr' ? item.product.nameGr : item.product.name
                return (
                  <div key={item.product.id} className="flex items-center gap-3 bg-bg-tertiary rounded-lg p-3">
                    <div className="w-10 h-10 bg-bg-primary rounded flex items-center justify-center shrink-0">
                      <ShoppingBag size={14} className="text-text-muted/30" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm text-text-primary truncate">{name}</p>
                      <p className="font-accent text-xs text-text-muted">€{item.product.price} each</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateQuantity(keyFor(item), item.quantity - 1)}
                        className="w-6 h-6 rounded bg-bg-primary border border-border flex items-center justify-center text-text-secondary hover:border-accent-amber transition-colors text-xs">−</button>
                      <span className="font-accent text-sm w-5 text-center text-text-primary">{item.quantity}</span>
                      <button onClick={() => updateQuantity(keyFor(item), item.quantity + 1)}
                        className="w-6 h-6 rounded bg-bg-primary border border-border flex items-center justify-center text-text-secondary hover:border-accent-amber transition-colors text-xs">+</button>
                    </div>
                    <span className="font-accent text-sm text-accent-amber w-16 text-right">€{(unitPriceFor(item) * item.quantity).toFixed(2)}</span>
                    <button onClick={() => removeItem(keyFor(item))} className="text-text-muted hover:text-red-400 text-xs">✕</button>
                  </div>
                )
              })}
              {items.length === 0 && (
                <p className="text-text-secondary text-center py-8">Cart is empty</p>
              )}
            </div>
          )}

          {/* Step 2 — Customer info */}
          {checkoutStep === 2 && (
            <div className="space-y-4">
              <input type="text" placeholder={t.checkout.name} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} className="input-field" required />
              <input type="email" placeholder={t.checkout.email} value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} className="input-field" required />
              <input type="tel" placeholder={t.checkout.phone} value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} className="input-field" required />

              <div>
                <p className="font-mono text-xs text-text-muted uppercase mb-2">{t.checkout.deliveryType}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setInfo({ ...info, deliveryType: 'delivery' })}
                    className={`flex-1 flex items-center gap-2 justify-center py-3 rounded-lg border font-mono text-sm transition-all ${
                      info.deliveryType === 'delivery' ? 'border-accent-amber text-accent-amber bg-accent-amber/5' : 'border-border text-text-secondary'
                    }`}
                  >
                    <Truck size={16} /> {t.checkout.deliveryOption}
                  </button>
                  <button
                    onClick={() => setInfo({ ...info, deliveryType: 'pickup' })}
                    className={`flex-1 flex items-center gap-2 justify-center py-3 rounded-lg border font-mono text-sm transition-all ${
                      info.deliveryType === 'pickup' ? 'border-accent-amber text-accent-amber bg-accent-amber/5' : 'border-border text-text-secondary'
                    }`}
                  >
                    <Package size={16} /> {t.checkout.pickupOption}
                  </button>
                </div>
              </div>

              {info.deliveryType === 'delivery' && (
                <>
                  <input type="text" placeholder={t.checkout.address} value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} className="input-field" required />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" placeholder={t.checkout.city} value={info.city} onChange={(e) => setInfo({ ...info, city: e.target.value })} className="input-field" required />
                    <input type="text" placeholder={t.checkout.postalCode} value={info.postalCode} onChange={(e) => setInfo({ ...info, postalCode: e.target.value })} className="input-field" required />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3 — Summary */}
          {checkoutStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                {items.map((item) => {
                  const name = language === 'gr' ? item.product.nameGr : item.product.name
                  return (
                    <div key={item.product.id} className="flex justify-between text-sm">
                      <span className="text-text-secondary">{name} × {item.quantity}</span>
                      <span className="font-accent text-text-primary">€{(item.product.price * item.quantity).toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">{t.checkout.subtotal}</span>
                  <span className="font-accent text-text-primary">€{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">{t.checkout.deliveryFee}</span>
                  <span className={`font-accent ${deliveryFee === 0 ? 'text-accent-green' : 'text-text-primary'}`}>
                    {deliveryFee === 0 ? t.checkout.free : `€${deliveryFee.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between text-lg border-t border-border pt-3">
                  <span className="font-mono font-bold text-text-primary">{t.checkout.orderTotal}</span>
                  <span className="font-mono font-bold text-accent-amber">€{total.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment notice */}
              <div className="bg-bg-tertiary rounded-lg p-4 text-center">
                <CreditCard size={24} className="mx-auto text-text-muted mb-2" />
                <p className="font-mono text-sm text-text-primary">{t.checkout.paymentNote}</p>
                <p className="text-text-muted text-xs mt-1">{t.checkout.paymentSoon}</p>
              </div>
            </div>
          )}

          {/* Step 4 — Confirmation */}
          {checkoutStep === 4 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-accent-green/10 border-2 border-accent-green rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-accent-green" />
              </div>
              <h3 className="font-mono text-2xl font-bold text-text-primary mb-2">{t.checkout.confirmTitle}</h3>
              <p className="text-text-secondary mb-6">{t.checkout.confirmMsg}</p>
              <button onClick={handleClose} className="btn-amber">
                {t.checkout.backToShop}
              </button>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        {checkoutStep < 4 && (
          <div className="flex items-center justify-between p-5 border-t border-border">
            <button
              onClick={() => checkoutStep === 1 ? handleClose() : setCheckoutStep(checkoutStep - 1)}
              className="btn-outline text-sm py-2 px-4 flex items-center gap-1.5"
            >
              <ArrowLeft size={14} /> {checkoutStep === 1 ? t.cart.continueShopping : t.checkout.back}
            </button>

            {checkoutStep < 3 ? (
              <button
                onClick={() => setCheckoutStep(checkoutStep + 1)}
                disabled={checkoutStep === 1 && items.length === 0 || checkoutStep === 2 && !canProceedStep2}
                className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t.checkout.next} <ArrowRight size={14} />
              </button>
            ) : (
              <button onClick={handlePlaceOrder} className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5">
                {t.checkout.placeOrder} <Check size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
