import { useState, useEffect, useRef } from 'react'
import { X, Printer, Download, Mail } from 'lucide-react'
import type { Invoice } from '@/stores/invoicesStore'
import { useContentStore } from '@/stores/contentStore'
import { AXIOM_FAVICON_SRC } from '@/components/BrandLogo'
import SendEmailModal from './SendEmailModal'

interface Props {
  doc: Invoice
  onClose: () => void
  // When true, automatically trigger PDF download after the document renders
  // (used by the portal's row-level Download button).
  autoDownload?: boolean
}

// Strip brand / part-number / extra labels from a stored material string and
// return only the filament kind (PLA / PETG / ABS / TPU / Resin / Nylon).
// Used in the customer-facing render so the brand never shows.
const FILAMENT_KINDS = ['PLA', 'PETG', 'ABS', 'TPU', 'Resin', 'Nylon']
function filamentKindOnly(material: string): string {
  const upper = material.toUpperCase()
  for (const k of FILAMENT_KINDS) {
    if (upper.includes(k.toUpperCase())) return k
  }
  return material
}

export default function DocumentPreview({ doc, onClose, autoDownload }: Props) {
  const contact = useContentStore((s) => s.content.contact)
  const isQuote = doc.type === 'quotation'
  const [downloading, setDownloading] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const autoTriggered = useRef(false)

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = async () => {
    setDownloading(true)
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const element = document.getElementById('printable-document')
      if (!element) {
        setDownloading(false)
        return
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })

      // A4 dimensions in mm
      const pdfWidth = 210
      const pdfHeight = 297
      const imgWidth = pdfWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const imgData = canvas.toDataURL('image/png')

      if (imgHeight <= pdfHeight) {
        // Fits on one page
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      } else {
        // Multi-page split
        let heightLeft = imgHeight
        let position = 0
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pdfHeight
        while (heightLeft > 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pdfHeight
        }
      }

      pdf.save(`${doc.documentNumber}.pdf`)
    } catch (err) {
      console.error('[pdf] export error:', err)
      alert('Failed to generate PDF. Try the Print option instead.')
    } finally {
      setDownloading(false)
    }
  }

  // Auto-trigger download once when opened with autoDownload (one-click flow
  // from a portal row's Download button). Closes the modal afterwards.
  useEffect(() => {
    if (!autoDownload || autoTriggered.current) return
    autoTriggered.current = true
    // Wait one frame for the printable element to be in the DOM.
    const t = setTimeout(async () => {
      await handleDownloadPDF()
      onClose()
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDownload])

  return (
    <div id="print-overlay" className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[95vh] overflow-y-auto relative">
        {/* Screen-only controls */}
        <div className="flex items-center justify-between p-4 border-b print:hidden">
          <h2 className="font-mono text-sm font-bold text-gray-800">Preview — {doc.documentNumber}</h2>
          <div className="flex gap-2">
            {/* Send by Email is admin-only — never expose this to a portal
                customer. Detect by current path: /admin/* shows it, /portal/*
                hides it. autoDownload mode also hides it (silent generator). */}
            {window.location.pathname.startsWith('/admin') && !autoDownload && (
              <button
                onClick={() => setShowEmail(true)}
                className="flex items-center gap-1.5 text-xs font-mono bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600"
              >
                <Mail size={13} /> Send by Email
              </button>
            )}
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-1.5 text-xs font-mono bg-amber-500 text-white px-3 py-1.5 rounded hover:bg-amber-600 disabled:opacity-50"
            >
              <Download size={13} /> {downloading ? 'Generating...' : 'Download PDF'}
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs font-mono bg-gray-200 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-300">
              <Printer size={13} /> Print
            </button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {showEmail && (
          <SendEmailModal doc={doc} pdfElementId="printable-document" onClose={() => setShowEmail(false)} />
        )}

        {/* Printable document */}
        <div id="printable-document" className="p-8 text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="flex items-center gap-3">
                <img src={AXIOM_FAVICON_SRC} alt="" className="h-12 w-12 object-contain" />
                <span className="text-2xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Axiom</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Professional 3D Printing Services</p>
              <p className="text-xs text-gray-500">{contact.location}</p>
              <p className="text-xs text-gray-500">{contact.email}</p>
            </div>
            <div className="text-right">
              <h1 className="text-xl font-bold uppercase tracking-wider" style={{ color: isQuote ? '#3B82F6' : '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>
                {isQuote ? 'Quotation' : 'Invoice'}
              </h1>
              <p className="text-sm font-mono text-gray-700 mt-1">{doc.documentNumber}</p>
              <p className="text-xs text-gray-500 mt-2">Date: {new Date(doc.date).toLocaleDateString('en-GB')}</p>
              {doc.validUntil && <p className="text-xs text-gray-500">Valid Until: {new Date(doc.validUntil).toLocaleDateString('en-GB')}</p>}
            </div>
          </div>

          {/* Bill To */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1 font-bold">Bill To</p>
            <p className="text-sm font-semibold">{doc.customerName}</p>
            {doc.customerCompany && <p className="text-sm text-gray-600">{doc.customerCompany}</p>}
            <p className="text-xs text-gray-500">{doc.customerEmail}</p>
            {doc.billingAddress && <p className="text-xs text-gray-500 mt-1">{doc.billingAddress}</p>}
            {(doc.billingCity || doc.billingPostalCode) && (
              <p className="text-xs text-gray-500">{[doc.billingCity, doc.billingPostalCode].filter(Boolean).join(', ')}</p>
            )}
            {doc.customerVatNumber && <p className="text-xs text-gray-500">VAT: {doc.customerVatNumber}</p>}
          </div>

          {/* When admin has overridden the final total, scale every line item
              proportionally so the math reconciles. Solve for the subtotal that
              would yield the override after discount + VAT + delivery + extra,
              then ratio-scale each line's unit price + total against the
              original subtotal. Customer sees normal-looking line items that
              correctly add up to the negotiated final number. */}
          {(() => {
            let lineScale = 1
            let displaySubtotal = doc.subtotal
            let displayDiscount = doc.discountAmount
            let displayVat = doc.vatAmount

            if (doc.totalOverride != null && doc.subtotal > 0) {
              const denom = (1 - (doc.discountPercent || 0) / 100) * (1 + (doc.vatRate || 0))
              const targetSubtotal = denom > 0
                ? (doc.totalOverride - (doc.deliveryFee || 0) - (doc.extraCharge || 0)) / denom
                : doc.totalOverride
              lineScale = targetSubtotal / doc.subtotal
              displaySubtotal = targetSubtotal
              displayDiscount = targetSubtotal * (doc.discountPercent || 0) / 100
              displayVat = (targetSubtotal - displayDiscount) * (doc.vatRate || 0)
            }

            return (
              <>
                <table className="w-full text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="border-b-2" style={{ borderColor: isQuote ? '#3B82F6' : '#F59E0B' }}>
                      <th className="text-left py-2 text-xs uppercase tracking-wider text-gray-500 font-bold">Description</th>
                      {doc.lineItems.some(i => i.material) && <th className="text-left py-2 text-xs uppercase tracking-wider text-gray-500 font-bold">Material</th>}
                      {doc.lineItems.some(i => i.weightGrams) && <th className="text-right py-2 text-xs uppercase tracking-wider text-gray-500 font-bold">Weight</th>}
                      <th className="text-right py-2 text-xs uppercase tracking-wider text-gray-500 font-bold">Unit Price</th>
                      <th className="text-right py-2 text-xs uppercase tracking-wider text-gray-500 font-bold">Qty</th>
                      <th className="text-right py-2 text-xs uppercase tracking-wider text-gray-500 font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.lineItems.map((item, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2">{item.description}</td>
                        {doc.lineItems.some(li => li.material) && <td className="py-2 text-gray-600 text-xs">{item.material ? filamentKindOnly(item.material) : '—'}</td>}
                        {doc.lineItems.some(li => li.weightGrams) && <td className="py-2 text-right text-gray-600">{item.weightGrams ? `${item.weightGrams}g` : '—'}</td>}
                        <td className="py-2 text-right">{(item.unitPrice * lineScale).toFixed(2)}</td>
                        <td className="py-2 text-right">{item.quantity}</td>
                        <td className="py-2 text-right font-medium">{(item.total * lineScale).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals — full breakdown shown in both modes; when overridden,
                    every number is recalculated from the scaled subtotal. */}
                <div className="flex justify-end mb-6">
                  <div className="w-64 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal</span>
                      <span>{displaySubtotal.toFixed(2)}</span>
                    </div>
                    {doc.discountPercent > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount ({doc.discountPercent}%)</span>
                        <span>-{displayDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {doc.vatRate > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">VAT ({(doc.vatRate * 100).toFixed(0)}%)</span>
                        <span>{displayVat.toFixed(2)}</span>
                      </div>
                    )}
                    {doc.deliveryFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Delivery</span>
                        <span>{doc.deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    {doc.extraCharge && doc.extraCharge > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{doc.extraChargeNote || 'Extra'}</span>
                        <span>{doc.extraCharge.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t-2 font-bold text-base" style={{ borderColor: isQuote ? '#3B82F6' : '#F59E0B' }}>
                      <span>Total (EUR)</span>
                      <span>{(doc.totalOverride ?? doc.total).toFixed(2)}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 text-right pt-0.5">
                      {doc.vatRate > 0
                        ? `Inclusive of Cyprus VAT ${(doc.vatRate * 100).toFixed(0)}%`
                        : 'VAT not included'}
                    </p>
                  </div>
                </div>
              </>
            )
          })()}

          {/* Payment Terms */}
          {doc.paymentTerms && doc.paymentTerms !== 'immediate' && (
            <div className="mb-4 text-xs text-gray-600">
              <span className="font-bold uppercase tracking-wider text-gray-400">Payment Terms: </span>
              {doc.paymentTerms === 'net15' ? 'Net 15 days' : doc.paymentTerms === 'net30' ? 'Net 30 days' : doc.paymentTerms === 'net60' ? 'Net 60 days' : doc.paymentTerms}
            </div>
          )}

          {/* Notes */}
          {doc.notes && (
            <div className="mb-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
              <p className="font-bold uppercase tracking-wider text-gray-400 mb-1">Notes</p>
              <p className="whitespace-pre-wrap">{doc.notes}</p>
            </div>
          )}

          {/* Terms & Conditions */}
          {doc.termsAndConditions && (
            <div className="mb-6 text-[11px] text-gray-500">
              <p className="font-bold uppercase tracking-wider text-gray-400 mb-1">Terms & Conditions</p>
              <p className="whitespace-pre-wrap leading-relaxed">{doc.termsAndConditions}</p>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400">
            <p>Axiom — Professional 3D Printing Services · Cyprus</p>
            <p>{contact.email} · {contact.whatsappNumber}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
