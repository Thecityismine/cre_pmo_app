import { useState } from 'react'
import { collection, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useBudgetItems } from '@/hooks/useBudgetItems'
import { Plus, Trash2, Check, X, TrendingUp, TrendingDown } from 'lucide-react'
import { clsx } from 'clsx'
import type { Project } from '@/types'

const CATEGORIES = ['Hard Cost', 'Soft Cost', 'FF&E', 'IT/AV', 'Contingency', "Owner's Reserve"]

const CATEGORY_COLORS: Record<string, string> = {
  'Hard Cost':       'bg-amber-900 text-amber-300',
  'Soft Cost':       'bg-blue-900 text-blue-300',
  'FF&E':            'bg-purple-900 text-purple-300',
  'IT/AV':           'bg-cyan-900 text-cyan-300',
  'Contingency':     'bg-slate-700 text-slate-300',
  "Owner's Reserve": 'bg-emerald-900 text-emerald-300',
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const inp = () => 'w-full bg-slate-900 text-slate-100 text-xs rounded px-2 py-1.5 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-600'

interface Props { project: Project }

function EditableRow({ item, onDelete }: { item: import('@/hooks/useBudgetItems').BudgetItem; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    description:    item.description,
    category:       item.category,
    budgetAmount:   String(item.budgetAmount),
    committedAmount: String(item.committedAmount),
    forecastAmount: String(item.forecastAmount),
    actualAmount:   String(item.actualAmount),
    notes:          item.notes,
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const budget   = Number(form.budgetAmount) || 0
    const forecast = Number(form.forecastAmount) || 0
    await updateDoc(doc(db, 'budgetItems', item.id), {
      description:     form.description,
      category:        form.category,
      budgetAmount:    budget,
      committedAmount: Number(form.committedAmount) || 0,
      forecastAmount:  forecast,
      actualAmount:    Number(form.actualAmount) || 0,
      variance:        budget - forecast,
      notes:           form.notes,
      updatedAt:       new Date().toISOString(),
    })
    setSaving(false)
    setEditing(false)
  }

  const variance = item.budgetAmount - item.forecastAmount

  if (editing) {
    return (
      <tr className="bg-slate-900/80 border-t border-slate-700">
        <td className="px-3 py-2" colSpan={6}>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" className={inp()} />
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp()}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <input type="number" value={form.budgetAmount} onChange={e => setForm(f => ({ ...f, budgetAmount: e.target.value }))} placeholder="Budget" className={inp()} />
              <input type="number" value={form.committedAmount} onChange={e => setForm(f => ({ ...f, committedAmount: e.target.value }))} placeholder="Committed" className={inp()} />
              <input type="number" value={form.forecastAmount} onChange={e => setForm(f => ({ ...f, forecastAmount: e.target.value }))} placeholder="Forecast" className={inp()} />
              <input type="number" value={form.actualAmount} onChange={e => setForm(f => ({ ...f, actualAmount: e.target.value }))} placeholder="Actual" className={inp()} />
            </div>
            <div className="flex gap-2">
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes" className={clsx(inp(), 'flex-1')} />
              <button onClick={save} disabled={saving} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg">
                <Check size={12} />{saving ? '...' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="flex items-center gap-1 border border-slate-600 text-slate-400 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800">
                <X size={12} />Cancel
              </button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-t border-slate-700 hover:bg-slate-800/40 group cursor-pointer" onClick={() => setEditing(true)}>
      <td className="px-4 py-2.5">
        <span className={clsx('text-xs px-2 py-0.5 rounded font-medium', CATEGORY_COLORS[item.category] ?? 'bg-slate-700 text-slate-300')}>
          {item.category}
        </span>
      </td>
      <td className="px-4 py-2.5 text-slate-200 text-sm">{item.description || '—'}</td>
      <td className="px-4 py-2.5 text-right text-slate-300 text-sm">{fmt(item.budgetAmount)}</td>
      <td className="px-4 py-2.5 text-right text-slate-300 text-sm">{fmt(item.forecastAmount)}</td>
      <td className="px-4 py-2.5 text-right text-slate-300 text-sm">{fmt(item.actualAmount)}</td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          {variance >= 0
            ? <TrendingDown size={13} className="text-emerald-400" />
            : <TrendingUp size={13} className="text-red-400" />}
          <span className={clsx('text-sm font-medium', variance >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {fmt(Math.abs(variance))}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(item.id) }}
            className="ml-2 p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  )
}

export function BudgetTab({ project }: Props) {
  const { items, loading } = useBudgetItems(project.id)
  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState({
    description: '', category: 'Hard Cost',
    budgetAmount: '', committedAmount: '', forecastAmount: '', actualAmount: '', notes: '',
  })
  const [saving, setSaving] = useState(false)

  const totalBudget   = items.reduce((s, i) => s + i.budgetAmount, 0)
  const totalForecast = items.reduce((s, i) => s + i.forecastAmount, 0)
  const totalActual   = items.reduce((s, i) => s + i.actualAmount, 0)
  const totalVariance = totalBudget - totalForecast

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const budget   = Number(newForm.budgetAmount) || 0
    const forecast = Number(newForm.forecastAmount) || budget
    const now = new Date().toISOString()
    await addDoc(collection(db, 'budgetItems'), {
      projectId:       project.id,
      category:        newForm.category,
      description:     newForm.description,
      budgetAmount:    budget,
      committedAmount: Number(newForm.committedAmount) || 0,
      forecastAmount:  forecast,
      actualAmount:    Number(newForm.actualAmount) || 0,
      variance:        budget - forecast,
      notes:           newForm.notes,
      createdAt:       now,
      updatedAt:       now,
    })
    setNewForm({ description: '', category: 'Hard Cost', budgetAmount: '', committedAmount: '', forecastAmount: '', actualAmount: '', notes: '' })
    setSaving(false)
    setAdding(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this budget line item?')) return
    await deleteDoc(doc(db, 'budgetItems', id))
  }

  // Group by category for summary
  const byCategory = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + i.budgetAmount
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Budget',   value: fmt(project.totalBudget || totalBudget), color: 'text-slate-100' },
          { label: 'Committed',      value: fmt(items.reduce((s, i) => s + i.committedAmount, 0)), color: 'text-blue-300' },
          { label: 'Forecast',       value: fmt(totalForecast), color: totalForecast > project.totalBudget ? 'text-red-400' : 'text-amber-300' },
          { label: 'Actual Spent',   value: fmt(totalActual), color: 'text-slate-200' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={clsx('text-lg font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Variance bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span>Budget Utilization</span>
          <span className={totalVariance < 0 ? 'text-red-400' : 'text-emerald-400'}>
            {totalVariance >= 0 ? `${fmt(totalVariance)} under budget` : `${fmt(Math.abs(totalVariance))} over budget`}
          </span>
        </div>
        <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden flex">
          <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${Math.min(100, totalActual / (project.totalBudget || 1) * 100)}%` }} />
          <div className="h-full bg-amber-500/60" style={{ width: `${Math.min(100, Math.max(0, (totalForecast - totalActual) / (project.totalBudget || 1) * 100))}%` }} />
        </div>
        <div className="flex gap-4 mt-2">
          <span className="text-xs text-emerald-400 flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />Actual</span>
          <span className="text-xs text-amber-400 flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/60 inline-block" />Remaining Forecast</span>
        </div>
      </div>

      {/* Category breakdown */}
      {Object.keys(byCategory).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(byCategory).map(([cat, amt]) => (
            <div key={cat} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
              <span className={clsx('text-xs px-2 py-0.5 rounded font-medium', CATEGORY_COLORS[cat] ?? 'bg-slate-700 text-slate-300')}>{cat}</span>
              <span className="text-slate-300 text-xs font-medium">{fmt(amt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Line items table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <p className="text-slate-100 font-semibold text-sm">Line Items</p>
          <button
            onClick={() => setAdding(!adding)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} /> Add Line Item
          </button>
        </div>

        {/* Add form */}
        {adding && (
          <form onSubmit={handleAdd} className="p-4 border-b border-slate-700 bg-slate-900/50 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" className={inp()} />
              <select value={newForm.category} onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))} className={inp()}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input type="number" value={newForm.budgetAmount} onChange={e => setNewForm(f => ({ ...f, budgetAmount: e.target.value }))} placeholder="Budget $" className={inp()} />
              <input type="number" value={newForm.committedAmount} onChange={e => setNewForm(f => ({ ...f, committedAmount: e.target.value }))} placeholder="Committed $" className={inp()} />
              <input type="number" value={newForm.forecastAmount} onChange={e => setNewForm(f => ({ ...f, forecastAmount: e.target.value }))} placeholder="Forecast $" className={inp()} />
              <input type="number" value={newForm.actualAmount} onChange={e => setNewForm(f => ({ ...f, actualAmount: e.target.value }))} placeholder="Actual $" className={inp()} />
            </div>
            <div className="flex gap-2">
              <input value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className={clsx(inp(), 'flex-1')} />
              <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-1.5 rounded-lg disabled:opacity-50">
                {saving ? '...' : 'Add'}
              </button>
              <button type="button" onClick={() => setAdding(false)} className="border border-slate-600 text-slate-400 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800">
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            <p className="text-sm">No line items yet.</p>
            <p className="text-xs mt-1">Click "Add Line Item" to start tracking costs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-700">
                  <th className="text-left px-4 py-2">Category</th>
                  <th className="text-left px-4 py-2">Description</th>
                  <th className="text-right px-4 py-2">Budget</th>
                  <th className="text-right px-4 py-2">Forecast</th>
                  <th className="text-right px-4 py-2">Actual</th>
                  <th className="text-right px-4 py-2">Variance</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => <EditableRow key={item.id} item={item} onDelete={handleDelete} />)}
                {/* Totals row */}
                <tr className="border-t-2 border-slate-600 bg-slate-900/50 font-semibold">
                  <td className="px-4 py-2.5 text-slate-300 text-xs" colSpan={2}>TOTAL</td>
                  <td className="px-4 py-2.5 text-right text-slate-200 text-sm">{fmt(totalBudget)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-200 text-sm">{fmt(totalForecast)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-200 text-sm">{fmt(totalActual)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={clsx('text-sm font-semibold', totalVariance >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {fmt(Math.abs(totalVariance))}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
