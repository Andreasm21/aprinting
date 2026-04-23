import { useState, useRef, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Check, Package, Upload, Image as ImageIcon, Box, Link as LinkIcon, FileText, Boxes } from 'lucide-react'
import { useContentStore } from '@/stores/contentStore'
import { useQuoteCartStore } from '@/stores/quoteCartStore'
import { useInventoryStore, type InventoryCategory } from '@/stores/inventoryStore'
import type { Product } from '@/types'

type ProductForm = Omit<Product, 'id'>

const emptyProduct: ProductForm = {
  name: '',
  nameGr: '',
  category: 'fdm',
  material: 'PLA',
  price: 0,
  description: '',
  descriptionGr: '',
  badge: '',
  inStock: true,
  modelUrl: '',
  imageUrl: '',
}

function ImageUploader({
  value,
  onChange,
  label,
  accept,
  hint,
}: {
  value: string
  onChange: (val: string | undefined) => void
  label: string
  accept: string
  hint: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [mode, setMode] = useState<'upload' | 'url'>(
    value && !value.startsWith('data:') && value.length > 0 ? 'url' : 'upload'
  )
  const [urlInput, setUrlInput] = useState(value && !value.startsWith('data:') ? value : '')

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      onChange(result)
    }
    reader.readAsDataURL(file)
  }, [onChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const isImage = accept.includes('image')
  const hasValue = !!value

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block font-mono text-xs text-text-muted uppercase">{label}</label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all ${
              mode === 'upload' ? 'bg-accent-amber/10 text-accent-amber' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Upload size={10} className="inline mr-1" />Upload
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all ${
              mode === 'url' ? 'bg-accent-amber/10 text-accent-amber' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <LinkIcon size={10} className="inline mr-1" />URL
          </button>
        </div>
      </div>

      {mode === 'upload' ? (
        <div className="flex gap-3">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-accent-amber bg-accent-amber/5'
                : 'border-border hover:border-accent-amber/50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={handleInputChange}
            />
            <Upload size={20} className="mx-auto text-text-muted/50 mb-1.5" />
            <p className="font-mono text-xs text-text-secondary">
              Drop file or click to browse
            </p>
            <p className="text-text-muted text-[10px] mt-1">{hint}</p>
          </div>

          {/* Preview */}
          {hasValue && (
            <div className="relative w-24 h-24 shrink-0 rounded-lg border border-border overflow-hidden bg-bg-tertiary flex items-center justify-center">
              {isImage ? (
                <img src={value} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <Box size={24} className="mx-auto text-accent-blue mb-1" />
                  <p className="text-[9px] font-mono text-text-muted">3D File</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white hover:bg-red-500 transition-colors"
              >
                <X size={10} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="flex-1 flex gap-2">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="input-field flex-1"
              placeholder="https://... or /images/product.jpg"
            />
            <button
              type="button"
              onClick={() => {
                if (urlInput.trim()) {
                  onChange(urlInput.trim())
                } else {
                  onChange(undefined)
                }
              }}
              className="btn-amber text-xs py-1.5 px-3 shrink-0"
            >
              Set
            </button>
          </div>
          {hasValue && !value.startsWith('data:') && isImage && (
            <div className="relative w-24 h-24 shrink-0 rounded-lg border border-border overflow-hidden bg-bg-tertiary flex items-center justify-center">
              <img src={value} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <button
                type="button"
                onClick={() => { onChange(undefined); setUrlInput('') }}
                className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white hover:bg-red-500 transition-colors"
              >
                <X size={10} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProductFormModal({
  initial,
  onSave,
  onClose,
  title,
}: {
  initial: ProductForm
  onSave: (data: ProductForm) => void
  onClose: () => void
  title: string
}) {
  const [form, setForm] = useState<ProductForm>(initial)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bg-secondary border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-bg-secondary z-10">
          <h2 className="font-mono text-lg font-bold text-text-primary">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded"><X size={20} className="text-text-muted" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Name (EN)</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Name (GR)</label>
              <input value={form.nameGr} onChange={(e) => setForm({ ...form, nameGr: e.target.value })} className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Product['category'] })} className="input-field">
                <option value="fdm">FDM</option>
                <option value="resin">Resin</option>
                <option value="custom">Custom</option>
                <option value="accessories">Accessories</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Material</label>
              <input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Price (€)</label>
              <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="input-field" required />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Description (EN)</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field resize-none" rows={2} />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Description (GR)</label>
            <textarea value={form.descriptionGr} onChange={(e) => setForm({ ...form, descriptionGr: e.target.value })} className="input-field resize-none" rows={2} />
          </div>

          {/* Product Image Upload */}
          <ImageUploader
            value={form.imageUrl || ''}
            onChange={(val) => setForm({ ...form, imageUrl: val })}
            label="Product Photo"
            accept="image/*"
            hint="JPG, PNG, WebP — recommended 800×800px"
          />

          {/* 3D Model Upload */}
          <ImageUploader
            value={form.modelUrl || ''}
            onChange={(val) => setForm({ ...form, modelUrl: val })}
            label="3D Model (.glb)"
            accept=".glb,.gltf"
            hint="GLB or GLTF — shown in 3D viewer on product card"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Badge (optional)</label>
              <input value={form.badge || ''} onChange={(e) => setForm({ ...form, badge: e.target.value || undefined })} className="input-field" placeholder="e.g. Premium, Customizable" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.inStock} onChange={(e) => setForm({ ...form, inStock: e.target.checked })} className="w-4 h-4 accent-accent-amber" />
                <span className="font-mono text-sm text-text-secondary">In Stock</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-outline text-sm py-2 px-4">Cancel</button>
            <button type="submit" className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5">
              <Check size={14} /> Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminProducts() {
  const { products, addProduct, updateProduct, deleteProduct } = useContentStore()
  const [editing, setEditing] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [justQuoted, setJustQuoted] = useState<number | null>(null)
  const [justAddedToInv, setJustAddedToInv] = useState<number | null>(null)
  const addToQuoteCart = useQuoteCartStore((s) => s.addItem)
  const inventoryProducts = useInventoryStore((s) => s.products)
  const addInventoryProduct = useInventoryStore((s) => s.addProduct)

  // Map storefront category to inventory category
  const mapToInventoryCategory = (product: Product): InventoryCategory => {
    const m = product.material.toUpperCase()
    if (m === 'PLA') return 'PLA'
    if (m === 'PETG') return 'PETG'
    if (m === 'ABS') return 'ABS'
    if (m === 'TPU') return 'TPU'
    if (m === 'NYLON') return 'Nylon'
    if (m === 'RESIN') return 'Resin'
    if (product.category === 'accessories') return 'Hardware'
    return 'Finished'
  }

  // Auto-generate next barcode (numeric, EAN-13-ish)
  const generateBarcode = () => {
    const allBarcodes = inventoryProducts.map((p) => p.barcode).filter((b): b is string => !!b && /^\d+$/.test(b))
    const nums = allBarcodes.map((b) => parseInt(b))
    const max = nums.length > 0 ? Math.max(...nums) : 4710881830100
    return String(max + 1).padStart(13, '0')
  }

  const handleAddToInventory = (product: Product) => {
    const partNumber = `AXM-PROD-${String(product.id).padStart(3, '0')}`
    // Check if already in inventory
    const existing = inventoryProducts.find((p) => p.partNumber === partNumber)
    if (existing) {
      alert(`Already in inventory as ${existing.partNumber}`)
      return
    }
    addInventoryProduct({
      partNumber,
      name: product.name,
      category: mapToInventoryCategory(product),
      brand: 'Axiom',
      cost: Math.round((product.price / 2) * 100) / 100, // estimate
      price: product.price,
      reorderLevel: 5,
      bin: 'STORE-A-1',
      barcode: generateBarcode(),
      supplier: 'In-house',
      archived: false,
    })
    setJustAddedToInv(product.id)
    setTimeout(() => setJustAddedToInv(null), 1500)
  }

  const handleQuote = (product: Product) => {
    addToQuoteCart({
      source: 'product',
      productId: String(product.id),
      description: product.name,
      unitPrice: product.price,
      material: product.category,
    })
    setJustQuoted(product.id)
    setTimeout(() => setJustQuoted(null), 1500)
  }

  const handleDelete = (id: number) => {
    if (confirmDelete === id) {
      deleteProduct(id)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(null), 3000)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-2xl font-bold text-text-primary">Products</h1>
          <p className="text-text-secondary text-sm">{products.length} products</p>
        </div>
        <button onClick={() => setAdding(true)} className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5">
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Products table */}
      <div className="card-base overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-bg-tertiary">
              <th className="text-left font-mono text-xs text-text-muted uppercase tracking-wider px-4 py-3">Product</th>
              <th className="text-left font-mono text-xs text-text-muted uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Category</th>
              <th className="text-left font-mono text-xs text-text-muted uppercase tracking-wider px-4 py-3 hidden md:table-cell">Material</th>
              <th className="text-left font-mono text-xs text-text-muted uppercase tracking-wider px-4 py-3">Price</th>
              <th className="text-right font-mono text-xs text-text-muted uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-border/50 hover:bg-bg-tertiary/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-bg-tertiary rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-border">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={16} className="text-text-muted/40" />
                      )}
                    </div>
                    <div>
                      <p className="font-mono text-sm text-text-primary">{product.name}</p>
                      <div className="flex items-center gap-2">
                        {product.badge && <span className="font-accent text-xs text-accent-amber">{product.badge}</span>}
                        {product.imageUrl && (
                          <span className="text-[10px] font-mono text-accent-green flex items-center gap-0.5">
                            <ImageIcon size={8} /> img
                          </span>
                        )}
                        {product.modelUrl && (
                          <span className="text-[10px] font-mono text-accent-blue flex items-center gap-0.5">
                            <Box size={8} /> 3d
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={`font-accent text-xs px-2 py-0.5 rounded border ${
                    product.category === 'resin' ? 'border-accent-blue/30 text-accent-blue'
                    : product.category === 'custom' ? 'border-accent-green/30 text-accent-green'
                    : 'border-accent-amber/30 text-accent-amber'
                  }`}>
                    {product.category.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell font-accent text-sm text-text-secondary">{product.material}</td>
                <td className="px-4 py-3 font-accent text-sm text-accent-amber">€{product.price}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleAddToInventory(product)}
                      className={`p-1.5 rounded transition-all ${
                        justAddedToInv === product.id
                          ? 'bg-accent-green/20 text-accent-green'
                          : 'hover:bg-bg-tertiary text-text-muted hover:text-accent-blue'
                      }`}
                      title="Add to inventory (with auto-barcode)"
                    >
                      {justAddedToInv === product.id ? <Check size={14} /> : <Boxes size={14} />}
                    </button>
                    <button
                      onClick={() => handleQuote(product)}
                      className={`p-1.5 rounded transition-all ${
                        justQuoted === product.id
                          ? 'bg-accent-green/20 text-accent-green'
                          : 'hover:bg-bg-tertiary text-text-muted hover:text-accent-amber'
                      }`}
                      title="Add to quote cart"
                    >
                      {justQuoted === product.id ? <span className="text-[10px] font-mono px-1">+1</span> : <FileText size={14} />}
                    </button>
                    <button
                      onClick={() => setEditing(product.id)}
                      className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-amber transition-all"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className={`p-1.5 rounded transition-all ${
                        confirmDelete === product.id
                          ? 'bg-red-500/10 text-red-400'
                          : 'hover:bg-bg-tertiary text-text-muted hover:text-red-400'
                      }`}
                      title={confirmDelete === product.id ? 'Click again to confirm' : 'Delete'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {products.length === 0 && (
          <div className="text-center py-12 text-text-muted">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No products yet. Add your first product!</p>
          </div>
        )}
      </div>

      {/* Add modal */}
      {adding && (
        <ProductFormModal
          title="Add Product"
          initial={emptyProduct}
          onClose={() => setAdding(false)}
          onSave={(data) => {
            addProduct(data)
            setAdding(false)
          }}
        />
      )}

      {/* Edit modal */}
      {editing !== null && (() => {
        const product = products.find((p) => p.id === editing)
        if (!product) return null
        const { id: _, ...formData } = product
        return (
          <ProductFormModal
            title="Edit Product"
            initial={formData}
            onClose={() => setEditing(null)}
            onSave={(data) => {
              updateProduct(editing, data)
              setEditing(null)
            }}
          />
        )
      })()}
    </div>
  )
}
