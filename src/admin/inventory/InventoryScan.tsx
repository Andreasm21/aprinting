import { useState, useEffect, useRef } from 'react'
import { ScanLine, Check, X, ArrowDownLeft, ArrowUpRight, RotateCcw, Minus, Plus, Camera, CameraOff } from 'lucide-react'
import { useInventoryStore, type MovementType, type InventoryProduct } from '@/stores/inventoryStore'
import InventoryLayout from './InventoryLayout'

export default function InventoryScan() {
  const getProductByBarcode = useInventoryStore((s) => s.getProductByBarcode)
  const getProductByPartNumber = useInventoryStore((s) => s.getProductByPartNumber)
  const getQtyOnHand = useInventoryStore((s) => s.getQtyOnHand)
  const addMovement = useInventoryStore((s) => s.addMovement)

  const [scanInput, setScanInput] = useState('')
  const [product, setProduct] = useState<InventoryProduct | null>(null)
  const [type, setType] = useState<MovementType>('OUT')
  const [qty, setQty] = useState(1)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const lookup = (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) return
    const found = getProductByBarcode(trimmed) || getProductByPartNumber(trimmed)
    if (found) {
      setProduct(found)
      setError('')
      setScanInput('')
    } else {
      setError(`Not found: ${trimmed}`)
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    lookup(scanInput)
  }

  const handleCommit = () => {
    if (!product) return
    addMovement({
      productId: product.id,
      type,
      qty: Math.abs(qty),
      unitCost: product.cost,
      reference: `SCAN-${Date.now().toString().slice(-4)}`,
    })
    setToast(`[ ${type === 'IN' ? 'STOCK IN' : type === 'OUT' ? 'STOCK OUT' : 'ADJUSTED'} · ${qty} ${type === 'OUT' ? 'UNITS REMOVED' : type === 'IN' ? 'UNITS LOGGED' : 'DELTA'} ]`)
    setTimeout(() => setToast(''), 2500)
    setProduct(null)
    setQty(1)
    setScanInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const toggleCamera = async () => {
    if (cameraActive) {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop()
        } catch {}
        scannerRef.current = null
      }
      setCameraActive(false)
      return
    }

    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!cameraRef.current) return
      const scanner = new Html5Qrcode('qr-camera')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decoded) => {
          lookup(decoded)
          scanner.stop().then(() => {
            scannerRef.current = null
            setCameraActive(false)
          })
        },
        () => {}
      )
      setCameraActive(true)
    } catch (err) {
      console.error('[scan] camera error:', err)
      setError('Camera unavailable. Use manual input or USB scanner.')
      setTimeout(() => setError(''), 3000)
    }
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const currentQty = product ? getQtyOnHand(product.id) : 0
  const typeOptions = [
    { value: 'IN' as const, icon: ArrowDownLeft, color: 'border-accent-green text-accent-green bg-accent-green/10' },
    { value: 'OUT' as const, icon: ArrowUpRight, color: 'border-red-400 text-red-400 bg-red-400/10' },
    { value: 'ADJUST' as const, icon: RotateCcw, color: 'border-accent-amber text-accent-amber bg-accent-amber/10' },
  ]
  const confirmColor = type === 'IN' ? 'bg-accent-green text-bg-primary' : type === 'OUT' ? 'bg-red-400 text-bg-primary' : 'bg-accent-amber text-bg-primary'

  return (
    <InventoryLayout>
      <div className="max-w-xl mx-auto">
        {/* Scan input */}
        {!product && (
          <div className="card-base p-6">
            <form onSubmit={handleSubmit}>
              <label className="block font-mono text-xs text-text-muted uppercase mb-2 tracking-wider">
                Scan or Type Code
              </label>
              <div className="relative">
                <ScanLine size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-amber" />
                <input
                  ref={inputRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Scan barcode or type part number..."
                  className="input-field pl-12 text-lg font-mono h-14 border-accent-amber focus:ring-2 focus:ring-accent-amber"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={toggleCamera}
                  className={`flex-1 py-2.5 rounded-lg border font-mono text-xs transition-all flex items-center justify-center gap-2 ${
                    cameraActive
                      ? 'border-red-400 text-red-400 bg-red-400/5'
                      : 'border-border text-text-muted hover:border-accent-amber hover:text-accent-amber'
                  }`}
                >
                  {cameraActive ? <><CameraOff size={14} /> Stop Camera</> : <><Camera size={14} /> Use Camera</>}
                </button>
                <button type="submit" className="btn-amber text-sm py-2.5 px-6 flex-1">
                  Lookup
                </button>
              </div>

              {cameraActive && (
                <div ref={cameraRef} id="qr-camera" className="mt-4 rounded-lg overflow-hidden border border-border" style={{ aspectRatio: '16/9' }} />
              )}

              {error && (
                <p className="text-red-400 text-xs font-mono mt-3 text-center">[ {error.toUpperCase()} ]</p>
              )}

              <p className="text-text-muted text-[11px] font-mono mt-4 text-center">
                Compatible with USB/Bluetooth scanners, device camera, or manual entry.
              </p>
            </form>
          </div>
        )}

        {/* Product found — action panel */}
        {product && (
          <div className="card-base p-6">
            <button
              onClick={() => { setProduct(null); setQty(1) }}
              className="text-text-muted hover:text-accent-amber text-xs font-mono mb-4 flex items-center gap-1"
            >
              <X size={12} /> Cancel
            </button>

            {/* Product info */}
            <div className="bg-bg-tertiary rounded-lg p-5 mb-5 border-l-4 border-accent-amber">
              <p className="font-mono text-2xl font-bold text-accent-amber mb-1">{product.partNumber}</p>
              <p className="text-text-primary text-sm mb-3">{product.name}</p>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div>
                  <p className="text-[10px] font-mono text-text-muted uppercase">Bin</p>
                  <p className="font-mono text-sm text-text-secondary">{product.bin || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono text-text-muted uppercase">Current Qty</p>
                  <p className="font-mono text-2xl font-bold text-accent-amber">{currentQty}</p>
                </div>
              </div>
            </div>

            {/* Type selector */}
            <div className="mb-5">
              <label className="block font-mono text-xs text-text-muted uppercase mb-2 tracking-wider">Type</label>
              <div className="grid grid-cols-3 gap-2">
                {typeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`py-4 rounded-lg border-2 font-mono text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                      type === opt.value ? opt.color : 'border-border text-text-muted hover:border-text-secondary'
                    }`}
                  >
                    <opt.icon size={16} />
                    {opt.value}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity stepper */}
            <div className="mb-5">
              <label className="block font-mono text-xs text-text-muted uppercase mb-2 tracking-wider">Quantity</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQty(type === 'ADJUST' ? qty - 1 : Math.max(1, qty - 1))}
                  className="w-14 h-14 rounded-lg border border-border hover:border-accent-amber flex items-center justify-center text-text-muted hover:text-accent-amber"
                >
                  <Minus size={22} />
                </button>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(parseInt(e.target.value) || 0)}
                  className="input-field text-center text-2xl font-mono font-bold flex-1 h-14"
                />
                <button
                  type="button"
                  onClick={() => setQty(qty + 1)}
                  className="w-14 h-14 rounded-lg border border-border hover:border-accent-amber flex items-center justify-center text-text-muted hover:text-accent-amber"
                >
                  <Plus size={22} />
                </button>
              </div>
            </div>

            {/* Confirm */}
            <button
              onClick={handleCommit}
              disabled={qty === 0}
              className={`${confirmColor} w-full font-mono text-base font-bold py-4 rounded-lg transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              <Check size={18} /> Confirm {type} · {qty}
            </button>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-bg-secondary border-l-4 border-accent-green px-5 py-3 rounded-r-lg shadow-xl">
            <p className="font-mono text-sm text-accent-green uppercase tracking-wider">{toast}</p>
          </div>
        )}
      </div>
    </InventoryLayout>
  )
}
