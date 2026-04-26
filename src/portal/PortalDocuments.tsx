import { useState, useMemo } from 'react'
import { FileText, Receipt, Eye, Package, ArrowLeft, Download } from 'lucide-react'
import { usePortalAuthStore } from '@/stores/portalAuthStore'
import { useInvoicesStore, type Invoice, type DocumentStatus } from '@/stores/invoicesStore'
import DocumentPreview from '@/admin/components/DocumentPreview'

const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: 'text-text-muted border-border',
  sent: 'text-accent-blue border-accent-blue/30 bg-accent-blue/5',
  paid: 'text-accent-green border-accent-green/30 bg-accent-green/5',
  cancelled: 'text-red-400 border-red-400/30 bg-red-400/5',
}

interface DocGroup {
  productName: string
  quotation?: Invoice
  invoice?: Invoice
  standalone: Invoice[]
}

function getProductName(doc: Invoice): string {
  if (doc.lineItems.length > 0) return doc.lineItems[0].description
  return 'Untitled'
}

function findLinkedQuotationNumber(doc: Invoice): string | null {
  if (!doc.notes) return null
  const m = doc.notes.match(/(?:From |Converted from )(QT-\d{4}-\d{4})/)
  return m ? m[1] : null
}

function buildGroups(docs: Invoice[]): DocGroup[] {
  const groups: DocGroup[] = []
  const used = new Set<string>()

  const quotations = docs.filter((d) => d.type === 'quotation')
  const invs = docs.filter((d) => d.type === 'invoice')

  for (const inv of invs) {
    const linkedQtNum = findLinkedQuotationNumber(inv)
    if (linkedQtNum) {
      const qt = quotations.find((q) => q.documentNumber === linkedQtNum)
      if (qt && !used.has(qt.id)) {
        groups.push({ productName: getProductName(qt), quotation: qt, invoice: inv, standalone: [] })
        used.add(qt.id)
        used.add(inv.id)
      }
    }
  }

  const remaining = docs.filter((d) => !used.has(d.id))
  const byProduct = new Map<string, Invoice[]>()
  for (const doc of remaining) {
    const name = getProductName(doc)
    if (!byProduct.has(name)) byProduct.set(name, [])
    byProduct.get(name)!.push(doc)
  }

  for (const [name, docList] of byProduct) {
    const qt = docList.find((d) => d.type === 'quotation')
    const inv = docList.find((d) => d.type === 'invoice')
    const rest = docList.filter((d) => d !== qt && d !== inv)
    groups.push({ productName: name, quotation: qt, invoice: inv, standalone: rest })
  }

  groups.sort((a, b) => {
    const aDate = (a.invoice || a.quotation || a.standalone[0])?.date || ''
    const bDate = (b.invoice || b.quotation || b.standalone[0])?.date || ''
    return new Date(bDate).getTime() - new Date(aDate).getTime()
  })

  return groups
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PortalDocuments() {
  const customer = usePortalAuthStore((s) => s.customer)
  const invoices = useInvoicesStore((s) => s.invoices)
  const [previewing, setPreviewing] = useState<Invoice | null>(null)
  const [downloading, setDownloading] = useState<Invoice | null>(null)

  const customerDocs = useMemo(() => {
    if (!customer) return []
    return invoices.filter((inv) => inv.customerId === customer.id || inv.customerEmail === customer.email)
  }, [invoices, customer])

  const groups = useMemo(() => buildGroups(customerDocs), [customerDocs])

  const renderDocRow = (doc: Invoice) => (
    <div key={doc.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-bg-tertiary/30 transition-colors">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
        doc.type === 'invoice' ? 'bg-accent-amber/10 text-accent-amber' : 'bg-accent-blue/10 text-accent-blue'
      }`}>
        {doc.type === 'invoice' ? <Receipt size={12} /> : <FileText size={12} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-accent-amber">{doc.documentNumber}</span>
          <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[doc.status]}`}>
            {doc.status === 'paid' && doc.type === 'quotation' ? 'accepted' : doc.status}
          </span>
        </div>
        <p className="text-[11px] text-text-muted">{formatDate(doc.date)} · €{doc.total.toFixed(2)}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setDownloading(doc)}
          className="p-1.5 hover:bg-bg-tertiary rounded text-text-muted hover:text-accent-amber"
          title="Download PDF"
        >
          <Download size={14} />
        </button>
        <button
          onClick={() => setPreviewing(doc)}
          className="p-1.5 hover:bg-bg-tertiary rounded text-text-muted hover:text-accent-amber"
          title="Preview"
        >
          <Eye size={14} />
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <h1 className="font-mono text-2xl font-bold text-text-primary mb-1">Documents</h1>
      <p className="text-text-secondary text-sm mb-6">Your quotations and invoices, grouped by product.</p>

      {groups.length === 0 ? (
        <div className="card-base p-10 text-center">
          <FileText size={32} className="mx-auto text-text-muted/20 mb-3" />
          <p className="text-text-muted text-sm font-mono">No documents yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group, i) => (
            <div key={i} className="card-base p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package size={14} className="text-accent-amber" />
                <h4 className="font-mono text-sm text-text-primary font-bold truncate">{group.productName}</h4>
                {group.quotation && group.invoice && (
                  <span className="ml-auto text-[10px] font-mono text-accent-green bg-accent-green/10 px-2 py-0.5 rounded-full border border-accent-green/20">
                    Complete
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {group.quotation && renderDocRow(group.quotation)}
                {group.quotation && group.invoice && (
                  <div className="flex items-center gap-2 pl-6 py-1">
                    <div className="w-px h-4 bg-border" />
                    <ArrowLeft size={10} className="text-accent-green rotate-[270deg]" />
                    <span className="text-[10px] font-mono text-accent-green">Converted to invoice</span>
                  </div>
                )}
                {group.invoice && renderDocRow(group.invoice)}
                {group.standalone.map((doc) => renderDocRow(doc))}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewing && <DocumentPreview doc={previewing} onClose={() => setPreviewing(null)} />}
      {/* Auto-download preview — opens, generates PDF, closes itself. */}
      {downloading && <DocumentPreview doc={downloading} onClose={() => setDownloading(null)} autoDownload />}
    </div>
  )
}
