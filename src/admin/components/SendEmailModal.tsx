import { useState } from 'react'
import { X, Send, Mail, Check, AlertCircle, Loader2, Paperclip } from 'lucide-react'
import type { Invoice } from '@/stores/invoicesStore'
import { useCustomersStore } from '@/stores/customersStore'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useEmailLogStore } from '@/stores/emailLogStore'
import { sendEmail, elementToPdfBase64 } from '@/lib/emailClient'
import { invoiceEmail, quotationEmail } from '@/lib/emailTemplates'

interface Props {
  doc: Invoice
  // The DOM element of the rendered document — used to generate the PDF attachment.
  pdfElementId: string
  onClose: () => void
}

export default function SendEmailModal({ doc, pdfElementId, onClose }: Props) {
  const customers = useCustomersStore((s) => s.customers)
  const customer = customers.find((c) => c.id === doc.customerId)
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const logEmail = useEmailLogStore((s) => s.log)

  // Default template based on document type
  const isQuote = doc.type === 'quotation'
  const tmpl = isQuote ? quotationEmail(doc, customer) : invoiceEmail(doc, customer)

  const [to, setTo] = useState(doc.customerEmail || customer?.email || '')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState(tmpl.subject)
  const [attachPdf, setAttachPdf] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const handleSend = async () => {
    setSending(true)
    setResult(null)
    try {
      // Generate PDF attachment from the rendered document.
      let attachments
      if (attachPdf) {
        const el = document.getElementById(pdfElementId) as HTMLElement | null
        if (!el) {
          setResult({ ok: false, msg: `Could not find document element (id="${pdfElementId}") to render as PDF.` })
          setSending(false)
          return
        }
        const att = await elementToPdfBase64(el, doc.documentNumber)
        attachments = [att]
      }

      const toList = to.split(',').map((s) => s.trim()).filter(Boolean)
      const ccList = cc.split(',').map((s) => s.trim()).filter(Boolean)

      const res = await sendEmail({
        to: toList.length === 1 ? toList[0] : toList,
        cc: ccList.length > 0 ? (ccList.length === 1 ? ccList[0] : ccList) : undefined,
        subject,
        html: tmpl.html,
        text: tmpl.text,
        attachments,
      })

      // Log every attempt (success or failure) to the audit/email log.
      await logEmail({
        to: toList,
        cc: ccList.length > 0 ? ccList : undefined,
        subject,
        template: isQuote ? 'quotation' : 'invoice',
        documentId: doc.id,
        customerId: doc.customerId,
        status: res.success ? 'sent' : 'failed',
        error: res.error,
        sentBy: currentUser?.username,
      })

      if (res.success) {
        setResult({ ok: true, msg: `Email sent successfully to ${toList.join(', ')}` })
        setTimeout(onClose, 1500)
      } else {
        setResult({ ok: false, msg: res.error || 'Failed to send email' })
      }
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bg-secondary border border-border rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-bg-secondary z-10">
          <h2 className="font-mono text-base font-bold text-text-primary flex items-center gap-2">
            <Mail size={16} className="text-accent-amber" /> Send {isQuote ? 'Quotation' : 'Invoice'} by Email
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Recipient */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">To *</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="customer@example.com"
              className="input-field text-sm"
              required
            />
            <p className="text-[10px] text-text-muted font-mono mt-1">Comma-separated for multiple recipients.</p>
          </div>

          {/* CC */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">CC (optional)</label>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="optional@example.com"
              className="input-field text-sm"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Subject *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input-field text-sm"
              required
            />
          </div>

          {/* Attach PDF toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-text-secondary text-sm">
            <input
              type="checkbox"
              checked={attachPdf}
              onChange={(e) => setAttachPdf(e.target.checked)}
              className="accent-accent-amber"
            />
            <Paperclip size={14} className="text-text-muted" />
            <span>Attach PDF of {isQuote ? 'quotation' : 'invoice'}</span>
          </label>

          {/* Body preview */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Email body preview</label>
            <div className="bg-bg-tertiary border border-border rounded p-3 max-h-64 overflow-y-auto">
              <iframe
                srcDoc={tmpl.html}
                title="email preview"
                className="w-full h-64 bg-white rounded border-0"
                sandbox=""
              />
            </div>
            <p className="text-[10px] text-text-muted font-mono mt-1">Body content is generated from the template — not editable here. Customize the customer name in their profile.</p>
          </div>

          {/* Result banner */}
          {result && (
            <div className={`flex items-start gap-2 p-3 rounded text-xs font-mono ${result.ok ? 'bg-accent-green/10 text-accent-green border border-accent-green/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
              {result.ok ? <Check size={14} /> : <AlertCircle size={14} />}
              <span>{result.msg}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-border sticky bottom-0 bg-bg-secondary">
          <button type="button" onClick={onClose} disabled={sending} className="btn-outline text-sm py-2 px-4 disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !to.trim() || !subject.trim()}
            className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5 disabled:opacity-50"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? 'Sending…' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  )
}
