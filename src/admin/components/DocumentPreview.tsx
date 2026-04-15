import { X, Printer } from 'lucide-react'
import type { Invoice } from '@/stores/invoicesStore'
import { useContentStore } from '@/stores/contentStore'

interface Props {
  doc: Invoice
  onClose: () => void
}

export default function DocumentPreview({ doc, onClose }: Props) {
  const contact = useContentStore((s) => s.content.contact)
  const isQuote = doc.type === 'quotation'

  const handlePrint = () => {
    window.print()
  }

  return (
    <div id="print-overlay" className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[95vh] overflow-y-auto relative">
        {/* Screen-only controls */}
        <div className="flex items-center justify-between p-4 border-b print:hidden">
          <h2 className="font-mono text-sm font-bold text-gray-800">Preview — {doc.documentNumber}</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs font-mono bg-amber-500 text-white px-3 py-1.5 rounded hover:bg-amber-600">
              <Printer size={13} /> Print / PDF
            </button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Printable document */}
        <div id="printable-document" className="p-8 text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="flex items-baseline gap-0">
                <span className="text-2xl font-bold" style={{ color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>A</span>
                <span className="text-2xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>xiom</span>
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

          {/* Line Items Table */}
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
                  {doc.lineItems.some(li => li.material) && <td className="py-2 text-gray-600 text-xs">{item.material || '—'}</td>}
                  {doc.lineItems.some(li => li.weightGrams) && <td className="py-2 text-right text-gray-600">{item.weightGrams ? `${item.weightGrams}g` : '—'}</td>}
                  <td className="py-2 text-right">{item.unitPrice.toFixed(2)}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right font-medium">{item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>{doc.subtotal.toFixed(2)}</span>
              </div>
              {doc.discountPercent > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount ({doc.discountPercent}%)</span>
                  <span>-{doc.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">VAT ({(doc.vatRate * 100).toFixed(0)}%)</span>
                <span>{doc.vatAmount.toFixed(2)}</span>
              </div>
              {doc.deliveryFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery</span>
                  <span>{doc.deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t-2 font-bold text-base" style={{ borderColor: isQuote ? '#3B82F6' : '#F59E0B' }}>
                <span>Total (EUR)</span>
                <span>{doc.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

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
