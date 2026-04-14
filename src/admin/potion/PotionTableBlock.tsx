import { useState } from 'react'
import { Plus, Trash2, MoreHorizontal } from 'lucide-react'
import { usePotionStore } from '@/stores/potionStore'
import type { PotionBlock, TableColumn, TableColumnType } from './types'

interface Props {
  block: PotionBlock
}

export default function PotionTableBlock({ block }: Props) {
  const updateBlock = usePotionStore((s) => s.updateBlock)
  const [editingHeader, setEditingHeader] = useState<string | null>(null)
  const [columnMenu, setColumnMenu] = useState<string | null>(null)

  if (!block.tableData) return null
  const { columns, rows } = block.tableData

  const genId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  const updateTable = (updates: Partial<typeof block.tableData>) => {
    updateBlock(block.id, { tableData: { ...block.tableData!, ...updates } })
  }

  const updateCell = (rowId: string, colId: string, value: string) => {
    const newRows = rows.map((r) =>
      r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r
    )
    updateTable({ rows: newRows })
  }

  const addColumn = () => {
    const col: TableColumn = { id: genId('col'), name: `Column ${columns.length + 1}`, type: 'text' }
    updateTable({ columns: [...columns, col] })
  }

  const deleteColumn = (colId: string) => {
    if (columns.length <= 1) return
    const newCols = columns.filter((c) => c.id !== colId)
    const newRows = rows.map((r) => {
      const cells = { ...r.cells }
      delete cells[colId]
      return { ...r, cells }
    })
    updateTable({ columns: newCols, rows: newRows })
    setColumnMenu(null)
  }

  const setColumnType = (colId: string, type: TableColumnType) => {
    const newCols = columns.map((c) => c.id === colId ? { ...c, type } : c)
    updateTable({ columns: newCols })
    setColumnMenu(null)
  }

  const renameColumn = (colId: string, name: string) => {
    const newCols = columns.map((c) => c.id === colId ? { ...c, name } : c)
    updateTable({ columns: newCols })
  }

  const addRow = () => {
    const row = { id: genId('row'), cells: {} as Record<string, string> }
    updateTable({ rows: [...rows, row] })
  }

  const deleteRow = (rowId: string) => {
    updateTable({ rows: rows.filter((r) => r.id !== rowId) })
  }

  // Calculate sums for number/currency columns
  const getSums = () => {
    const sums: Record<string, number> = {}
    columns.forEach((col) => {
      if (col.type === 'number' || col.type === 'currency') {
        sums[col.id] = rows.reduce((acc, row) => {
          const val = parseFloat(row.cells[col.id] || '0')
          return acc + (isNaN(val) ? 0 : val)
        }, 0)
      }
    })
    return sums
  }

  const sums = getSums()

  return (
    <div className="border border-border rounded-lg overflow-hidden my-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Header */}
          <thead>
            <tr className="bg-bg-tertiary border-b border-border">
              {columns.map((col) => (
                <th key={col.id} className="relative border-r border-border last:border-r-0 p-0">
                  <div className="flex items-center group">
                    {editingHeader === col.id ? (
                      <input
                        autoFocus
                        value={col.name}
                        onChange={(e) => renameColumn(col.id, e.target.value)}
                        onBlur={() => setEditingHeader(null)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setEditingHeader(null) }}
                        className="w-full bg-transparent px-2 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-amber"
                      />
                    ) : (
                      <span
                        onClick={() => setEditingHeader(col.id)}
                        className="flex-1 px-2 py-1.5 text-xs font-mono text-text-muted uppercase cursor-pointer truncate"
                      >
                        {col.name}
                        {col.type !== 'text' && (
                          <span className="ml-1 text-[9px] text-text-muted/50">
                            {col.type === 'currency' ? '€' : '#'}
                          </span>
                        )}
                      </span>
                    )}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setColumnMenu(columnMenu === col.id ? null : col.id)}
                        className="p-1 opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary transition-opacity"
                      >
                        <MoreHorizontal size={10} />
                      </button>
                      {columnMenu === col.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setColumnMenu(null)} />
                          <div className="absolute right-0 top-6 z-50 bg-bg-secondary border border-border rounded-lg shadow-xl py-1 min-w-[130px]">
                            <div className="px-2 py-1 text-[9px] font-mono uppercase text-text-muted">Type</div>
                            {(['text', 'number', 'currency'] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setColumnType(col.id, t)}
                                className={`w-full text-left px-3 py-1 text-xs font-mono ${col.type === t ? 'text-accent-amber' : 'text-text-secondary hover:bg-bg-tertiary'}`}
                              >
                                {t === 'currency' ? 'Currency (€)' : t.charAt(0).toUpperCase() + t.slice(1)}
                              </button>
                            ))}
                            <div className="border-t border-border mt-1 pt-1">
                              <button
                                type="button"
                                onClick={() => deleteColumn(col.id)}
                                className="w-full flex items-center gap-1.5 px-3 py-1 text-xs font-mono text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 size={10} /> Delete
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </th>
              ))}
              <th className="w-8 p-0">
                <button
                  type="button"
                  onClick={addColumn}
                  className="w-full py-1.5 text-text-muted hover:text-accent-amber transition-colors"
                  title="Add column"
                >
                  <Plus size={12} className="mx-auto" />
                </button>
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-b-0 group/row hover:bg-bg-tertiary/30">
                {columns.map((col) => (
                  <td key={col.id} className="border-r border-border last:border-r-0 p-0">
                    <input
                      value={row.cells[col.id] || ''}
                      onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                      placeholder="—"
                      className={`w-full bg-transparent px-2 py-1.5 text-xs text-text-primary placeholder-text-muted/30 focus:outline-none focus:bg-accent-amber/5 ${
                        col.type === 'number' || col.type === 'currency' ? 'text-right font-mono' : ''
                      }`}
                    />
                  </td>
                ))}
                <td className="w-8 p-0 text-center">
                  <button
                    type="button"
                    onClick={() => deleteRow(row.id)}
                    className="p-1 opacity-0 group-hover/row:opacity-100 text-text-muted hover:text-red-400 transition-opacity"
                    title="Delete row"
                  >
                    <Trash2 size={10} />
                  </button>
                </td>
              </tr>
            ))}

            {/* Sum row */}
            {Object.keys(sums).length > 0 && (
              <tr className="bg-bg-tertiary/50 border-t border-border">
                {columns.map((col) => (
                  <td key={col.id} className="border-r border-border last:border-r-0 px-2 py-1">
                    {sums[col.id] !== undefined ? (
                      <span className="text-xs font-mono text-accent-amber text-right block">
                        {col.type === 'currency' ? `€${sums[col.id].toFixed(2)}` : sums[col.id].toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted/30">—</span>
                    )}
                  </td>
                ))}
                <td className="w-8" />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      <button
        type="button"
        onClick={addRow}
        className="w-full flex items-center justify-center gap-1 py-1.5 text-xs font-mono text-text-muted hover:text-accent-amber hover:bg-bg-tertiary/50 transition-colors border-t border-border"
      >
        <Plus size={12} /> New row
      </button>
    </div>
  )
}
