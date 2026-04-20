import { useEffect, useRef } from 'react'
import { X, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import JsBarcode from 'jsbarcode'
import type { InventoryProduct } from '@/stores/inventoryStore'

export default function InventoryLabelModal({
  product,
  onClose,
}: {
  product: InventoryProduct
  onClose: () => void
}) {
  const barcodeRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, product.barcode || product.partNumber, {
          format: 'CODE128',
          width: 1.8,
          height: 50,
          displayValue: true,
          fontSize: 11,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000',
        })
      } catch (err) {
        console.error('Barcode generation failed:', err)
      }
    }
  }, [product])

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=400,height=400')
    if (!w) return

    // Serialize QR code and barcode from the preview
    const qrEl = document.getElementById(`qr-${product.id}`)
    const bcEl = document.getElementById(`bc-${product.id}`)
    const qrHtml = qrEl?.innerHTML || ''
    const bcHtml = bcEl?.outerHTML || ''

    w.document.write(`
      <!DOCTYPE html><html><head><title>Label ${product.partNumber}</title>
      <style>
        @page { size: 65mm 55mm; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: ui-monospace, 'JetBrains Mono', monospace; width: 65mm; height: 55mm; display: flex; flex-direction: column; }
        .header { background: #F59E0B; color: white; padding: 2mm 3mm; display: flex; justify-content: space-between; font-size: 8pt; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase; }
        .body { flex: 1; padding: 2mm 3mm; display: flex; flex-direction: column; gap: 1mm; }
        .partnum { font-size: 10pt; font-weight: bold; color: #000; }
        .name { font-size: 7pt; color: #333; line-height: 1.2; max-height: 2.4em; overflow: hidden; }
        .codes { display: flex; gap: 2mm; align-items: center; margin-top: auto; }
        .codes svg.barcode { flex: 1; max-width: 40mm; }
        .codes .qr { width: 15mm; height: 15mm; }
        .codes .qr svg { width: 100%; height: 100%; }
        .bin { background: #f1f5f9; padding: 1.5mm 3mm; font-size: 9pt; font-weight: bold; text-align: center; border-top: 1px solid #cbd5e1; }
      </style>
      </head><body>
      <div class="header"><span>AXIOM.STUDIO</span><span>${product.category}</span></div>
      <div class="body">
        <div class="partnum">${product.partNumber}</div>
        <div class="name">${product.name}</div>
        <div class="codes">
          ${bcHtml}
          <div class="qr">${qrHtml}</div>
        </div>
      </div>
      ${product.bin ? `<div class="bin">BIN ${product.bin}</div>` : ''}
      <script>
        window.onload = () => { setTimeout(() => { window.print(); setTimeout(() => window.close(), 500); }, 300); };
      </script>
      </body></html>
    `)
    w.document.close()
  }

  const qrValue = product.barcode || product.partNumber

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white text-gray-900 rounded-lg max-w-md w-full relative" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <h2 className="font-mono text-sm font-bold text-gray-800">Label Preview — {product.partNumber}</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs font-mono bg-amber-500 text-white px-3 py-1.5 rounded hover:bg-amber-600"
            >
              <Printer size={13} /> Print Label
            </button>
            <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Label replica at 2x */}
        <div className="p-6">
          <div
            className="mx-auto border-2 border-gray-300 flex flex-col"
            style={{ width: '260px', height: '220px' }}
          >
            {/* Header strip */}
            <div className="flex items-center justify-between px-3 py-1.5" style={{ background: '#F59E0B' }}>
              <span className="text-xs font-bold text-white uppercase tracking-wider">Axiom.Studio</span>
              <span className="text-[10px] font-bold text-white uppercase">{product.category}</span>
            </div>

            {/* Body */}
            <div className="flex-1 px-3 py-2 flex flex-col gap-1">
              <div className="text-sm font-bold text-gray-900">{product.partNumber}</div>
              <div className="text-[10px] text-gray-600 leading-tight line-clamp-2">{product.name}</div>

              <div className="flex items-end gap-2 mt-auto">
                <div id={`bc-${product.id}`} style={{ flex: 1 }}>
                  <svg ref={barcodeRef} className="barcode" />
                </div>
                <div id={`qr-${product.id}`} style={{ width: 60, height: 60 }}>
                  <QRCodeSVG value={qrValue} size={60} level="M" />
                </div>
              </div>
            </div>

            {/* Bin strip */}
            {product.bin && (
              <div className="bg-slate-100 border-t border-slate-300 py-1 text-center">
                <span className="text-xs font-bold text-gray-800">BIN {product.bin}</span>
              </div>
            )}
          </div>

          <p className="text-center text-gray-500 text-[10px] mt-3 font-mono">
            65mm × 55mm label · Print uses actual size
          </p>
        </div>
      </div>
    </div>
  )
}
