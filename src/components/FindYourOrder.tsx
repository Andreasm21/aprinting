// Public 'Find Your Order' section — like an airline 'find your booking'
// strip. Customer enters their email + order number to land on the public
// tracking page. Also exposes a 'Request Password Change' tab that pings
// the admin (no automatic reset — admin sends a fresh password manually).

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, AlertCircle, Check, KeyRound, Package, ArrowRight } from 'lucide-react'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { supabase } from '@/lib/supabase'
import { useNotificationsStore } from '@/stores/notificationsStore'

type Mode = 'find' | 'reset'

export default function FindYourOrder() {
  const ref = useScrollReveal<HTMLElement>()
  const navigate = useNavigate()
  const addAdminAlert = useNotificationsStore((s) => s.addAdminAlert)

  const [mode, setMode] = useState<Mode>('find')
  const [email, setEmail] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleFindOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!email.trim() || !orderNumber.trim()) return
    setSubmitting(true)
    try {
      // Look up the order by order_number, then verify the email matches the
      // linked invoice's customer_email. We do it in two steps so we can give
      // a generic 'not found / email mismatch' error either way (no leakage
      // of which orders exist).
      const { data: ord, error: ordErr } = await supabase
        .from('orders')
        .select('id, invoice_id, customer_id')
        .ilike('order_number', orderNumber.trim())
        .limit(1)
        .maybeSingle()
      if (ordErr || !ord) {
        setError("We couldn't find an order matching that number and email.")
        return
      }
      // Verify email — check via invoice's customer_email OR customer record.
      let emailOk = false
      if (ord.invoice_id) {
        const { data: inv } = await supabase
          .from('documents')
          .select('customer_email')
          .eq('id', ord.invoice_id)
          .maybeSingle()
        if (inv?.customer_email?.toLowerCase() === email.trim().toLowerCase()) emailOk = true
      }
      if (!emailOk && ord.customer_id) {
        const { data: cust } = await supabase
          .from('customers')
          .select('email')
          .eq('id', ord.customer_id)
          .maybeSingle()
        if (cust?.email?.toLowerCase() === email.trim().toLowerCase()) emailOk = true
      }
      if (!emailOk) {
        setError("We couldn't find an order matching that number and email.")
        return
      }
      navigate(`/track/${ord.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!email.trim()) return
    setSubmitting(true)
    try {
      await addAdminAlert({
        kind: 'account_requested',
        title: `Password reset requested by ${email.trim()}`,
        message: resetMessage.trim() || 'Customer requested a portal password reset from the website.',
        context: { customerEmail: email.trim() },
      })
      setSuccess("Got it — we'll email you a new password shortly.")
      setEmail('')
      setResetMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your request. Please email team@axiomcreate.com instead.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="find-order" ref={ref} className="py-20 md:py-24 bg-bg-secondary border-y border-border">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 reveal">
          <h2 className="section-title">
            <span className="section-title-amber">FIND YOUR ORDER</span>
          </h2>
          <p className="text-text-secondary text-sm mt-3">
            Track an existing order or request a portal password reset.
          </p>
        </div>

        <div className="reveal">
          {/* Mode toggle */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-bg-tertiary border border-border rounded-full p-1">
              <button
                type="button"
                onClick={() => { setMode('find'); setError(null); setSuccess(null) }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-mono text-xs font-bold uppercase tracking-wider transition-all ${
                  mode === 'find' ? 'bg-accent-amber text-bg-primary' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Package size={13} /> Find Order
              </button>
              <button
                type="button"
                onClick={() => { setMode('reset'); setError(null); setSuccess(null) }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-mono text-xs font-bold uppercase tracking-wider transition-all ${
                  mode === 'reset' ? 'bg-accent-amber text-bg-primary' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <KeyRound size={13} /> Reset Password
              </button>
            </div>
          </div>

          {/* Find Order form */}
          {mode === 'find' && (
            <form onSubmit={handleFindOrder} className="card-base p-6 space-y-4">
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Order number</label>
                <input
                  type="text"
                  required
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="ORD-2026-0001"
                  className="input-field text-sm font-mono"
                />
                <p className="text-[10px] font-mono text-text-muted mt-1">
                  The order number is in the email we sent you when your quote was accepted.
                </p>
              </div>
              <button
                type="submit"
                disabled={submitting || !email.trim() || !orderNumber.trim()}
                className="btn-amber w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {submitting ? 'Looking up…' : 'Find My Order'}
                {!submitting && <ArrowRight size={14} />}
              </button>
            </form>
          )}

          {/* Reset Password form */}
          {mode === 'reset' && (
            <form onSubmit={handleRequestReset} className="card-base p-6 space-y-4">
              <p className="text-text-secondary text-xs">
                Enter the email address linked to your portal account. We'll email you a new password — usually within an hour.
              </p>
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Anything else? (optional)</label>
                <textarea
                  value={resetMessage}
                  onChange={(e) => setResetMessage(e.target.value)}
                  placeholder="e.g. 'Tried to log in earlier and got locked out'"
                  rows={3}
                  className="input-field text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="btn-amber w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                {submitting ? 'Submitting…' : 'Request Password Reset'}
              </button>
            </form>
          )}

          {/* Status messages */}
          {error && (
            <div className="mt-4 card-base bg-red-500/5 border-red-500/30 p-3 text-xs font-mono text-red-400 flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {success && (
            <div className="mt-4 card-base bg-accent-green/5 border-accent-green/30 p-3 text-xs font-mono text-accent-green flex items-start gap-2">
              <Check size={14} className="shrink-0 mt-0.5" /> {success}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
