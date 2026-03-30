import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, Package } from 'lucide-react'
import { useContentStore } from '@/stores/contentStore'
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
      <div className="bg-bg-secondary border border-border rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-bg-secondary">
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

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">3D Model URL (.glb)</label>
            <input value={form.modelUrl || ''} onChange={(e) => setForm({ ...form, modelUrl: e.target.value || undefined })} className="input-field" placeholder="https://... or /models/product.glb" />
            <p className="text-text-muted text-xs mt-1">Upload a .glb file to your public folder and paste the path here. The 3D viewer will show on the product card.</p>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Image URL (fallback)</label>
            <input value={form.imageUrl || ''} onChange={(e) => setForm({ ...form, imageUrl: e.target.value || undefined })} className="input-field" placeholder="https://... or /images/product.jpg" />
          </div>

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
                    <div className="w-8 h-8 bg-bg-tertiary rounded flex items-center justify-center shrink-0">
                      <Package size={14} className="text-text-muted/40" />
                    </div>
                    <div>
                      <p className="font-mono text-sm text-text-primary">{product.name}</p>
                      {product.badge && <span className="font-accent text-xs text-accent-amber">{product.badge}</span>}
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
